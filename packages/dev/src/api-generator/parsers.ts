import { join, resolve } from "node:path";

import glob from "fast-glob";
import fsx from "fs-extra";
import crc32 from "crc/crc32";
import { parse } from "smol-toml";
import { sanitizePath } from "@appril/dev-utils";

import {
  type PluginOptionsResolved,
  type RouteOptions,
  type RouteSection,
  type ApiRoute,
  type ApiRouteAlias,
  normalizeRoutePath,
  routeSections,
  defaults,
} from "@/base";

type ParsedEntry = {
  route: ApiRoute;
  alias: Array<ApiRouteAlias>;
};

export async function sourceFilesParsers(
  config: import("vite").ResolvedConfig,
  _options: PluginOptionsResolved,
  pattern = `*${defaults.sourceFile}`,
) {
  const parsers: Array<{
    file: string;
    parser: () => Promise<Array<ParsedEntry>>;
  }> = [];

  const srcFiles = await glob(pattern, {
    cwd: config.root,
    onlyFiles: true,
    absolute: true,
    unique: true,
  });

  for (const srcFile of srcFiles) {
    parsers.push({
      file: srcFile,
      async parser() {
        const routeDefs = parse(await fsx.readFile(srcFile, "utf8"));

        const entries: Array<ParsedEntry> = [];

        for (const [_path, opt] of Object.entries(routeDefs) as Array<
          [path: string, opt: RouteOptions | undefined]
        >) {
          if (opt?.api === false) {
            continue;
          }

          const sections = routeSections(normalizeRoutePath(_path), srcFile);
          const originalPath = sections.map((e) => e.orig).join("/");

          const path = sections
            .map(({ orig, param, ext }) => {
              if (param) {
                if (param.isRest) {
                  return `:${param.name}(.*)${ext}`;
                }
                const suffix = param.isOpt ? "?" : "";
                return `:${param.name + ext + suffix}`;
              }
              return orig;
            })
            .join("/");

          const importPath = opt?.file
            ? sanitizePath(opt.file).replace(/\.[^.]+$/, "")
            : originalPath;

          const importName = importNameFromPath(importPath);

          const base = opt?.base;

          const suffix = [
            // place file in a folder
            // if it's a base route
            path.includes("/") === false,
            // or path explicitly ends in a slash
            /\/$/.test(_path),
            // or route has dataLoader explicitly enabled
            // (e.g. not as a custom path and not as an alias)
            opt?.dataLoader === true,
          ].some((e) => e)
            ? "/index.ts"
            : ".ts";

          const file = importPath + suffix;

          const paramsSections: Array<Required<RouteSection>["param"]> =
            sections.slice(1).flatMap((e) => (e.param ? [e.param] : []));

          const paramsLiteral = paramsSections
            .map((param) => {
              return param.isRest
                ? `${param.name}?: Array<${param.type}>`
                : `${param.name}${param.isOpt ? "?" : ""}: ${param.type}`;
            })
            .join("; ");

          const fetchParamsLiteral = paramsSections
            .map((param) => {
              return param.isRest
                ? `...${param.name}: Array<${param.type}>`
                : `${param.name}${param.isOpt ? "?" : ""}: ${param.type}`;
            })
            .join(
              ", ", // intentionally using comma, do not use semicolon!
            );

          const route: ApiRoute = {
            base,
            path: join("/", path.replace(/^index\/?\b/, "")),
            originalPath,
            params: {
              id: ["ParamsT", crc32(importName)].join(""),
              schema: JSON.stringify(paramsSections),
              literal: paramsLiteral,
            },
            fetchParams: { literal: fetchParamsLiteral },
            importName,
            importPath,
            srcFile,
            file,
            fileFullpath: resolve(config.root, defaults.apiDir, file),
            optedFile: opt?.file,
            meta: opt?.meta,
          };

          const alias: Array<ApiRouteAlias> = [];
          const aliasOf = route.path;

          if (Array.isArray(opt?.alias)) {
            for (const e of opt.alias) {
              if (typeof e === "string") {
                alias.push({
                  aliasOf,
                  base,
                  path: e,
                  originalPath: e,
                  importName: importNameFromPath(importPath + e),
                });
              } else if (typeof e === "object") {
                alias.push({
                  aliasOf,
                  base,
                  path: path.replace(e.find, e.replace),
                  originalPath: originalPath.replace(e.find, e.replace),
                  importName: importNameFromPath(
                    importPath.replace(e.find, e.replace),
                  ),
                });
              }
            }
          } else if (typeof opt?.alias === "object") {
            alias.push({
              aliasOf,
              base,
              path: path.replace(opt.alias.find, opt.alias.replace),
              originalPath: originalPath.replace(
                opt.alias.find,
                opt.alias.replace,
              ),
              importName: importNameFromPath(
                importPath.replace(opt.alias.find, opt.alias.replace),
              ),
            });
          } else if (typeof opt?.alias === "string") {
            alias.push({
              aliasOf,
              base,
              path: opt.alias,
              originalPath: opt.alias,
              importName: importNameFromPath(importPath + opt.alias),
            });
          }

          entries.push({ route, alias });
        }

        return entries;
      },
    });
  }

  return parsers;
}

function importNameFromPath(path: string): string {
  return [
    path
      .split(/\[/)[0]
      .replace(/^\W+|\W+$/g, "")
      .replace(/\W+/g, "_"),
    crc32(path),
  ].join("_");
}
