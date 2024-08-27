import { join, resolve } from "node:path";

import glob from "fast-glob";
import fsx from "fs-extra";
import crc32 from "crc/crc32";
import { parse } from "smol-toml";
import { sanitizePath } from "@appril/dev-utils";

import { normalizeRoutePath, routeSections, defaults } from "../base";

import type {
  ResolvedPluginOptions,
  RouteOptions,
  ApiRoute,
  ApiRouteAlias,
} from "../@types";

type ParsedEntry = {
  route: ApiRoute;
  alias: Array<ApiRouteAlias>;
};

export async function sourceFilesParsers(
  _config: import("vite").ResolvedConfig,
  options: ResolvedPluginOptions,
  pattern = `*${defaults.sourceFile}`,
) {
  const { root } = options;

  const parsers: Array<{
    file: string;
    parser: () => Promise<Array<ParsedEntry>>;
  }> = [];

  const srcFiles = await glob(pattern, {
    cwd: root,
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

          const originalPath = normalizeRoutePath(_path);

          const sections = routeSections(originalPath);

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

          const suffix = opt?.file
            ? sanitizePath(opt.file).replace(/.+(\.[^.]+)$/, "$1")
            : /\/$/.test(_path) || !path.includes("/")
              ? "/index.ts"
              : ".ts";

          const file = importPath + suffix;

          const paramsType = sections
            .slice(1)
            .flatMap(({ param }) => {
              if (param) {
                if (param.isRest) {
                  return [`${param.name}?: Array<string>`];
                }
                const suffix = param.isOpt ? "?" : "";
                return [`${param.name + suffix}: string`];
              }
              return [];
            })
            .join(", ");

          const fetchParamsType = sections
            .slice(1)
            .flatMap(({ param }) => {
              if (param) {
                if (param.isRest) {
                  return [`...${param.name}: Array<string | number>`];
                }
                const suffix = param.isOpt ? "?" : "";
                return [`${param.name + suffix}: string | number`];
              }
              return [];
            })
            .join(", ");

          const route: ApiRoute = {
            base,
            path: path === "index" ? "/" : join("/", path),
            originalPath,
            paramsType,
            fetchParamsType,
            importName,
            importPath,
            srcFile,
            file,
            fileFullpath: resolve(root, defaults.apiDir, file),
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
  return [path.replace(/\W/g, "_"), crc32(path)].join("$");
}
