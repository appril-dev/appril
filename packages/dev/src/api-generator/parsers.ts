import { dirname, join, resolve } from "node:path";

import glob from "fast-glob";
import fsx from "fs-extra";
import crc32 from "crc/crc32";
import { parse } from "smol-toml";
import { render } from "@appril/dev-utils";

import {
  type PluginOptionsResolved,
  type RouteOptions,
  type ApiRoute,
  normalizeRoutePath,
  pathTokensFactory,
  defaults,
  routeAlias,
  importNameFromPath,
} from "@/base";

import paramsTpl from "./templates/params.hbs";

type ParsedEntry = {
  route: ApiRoute;
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

          const pathTokens = pathTokensFactory(
            normalizeRoutePath(_path),
            srcFile,
          );

          const originalPath = pathTokens.map((e) => e.orig).join("/");

          const path = pathTokens
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

          const importPath = originalPath;
          const importName = importNameFromPath(importPath);

          const suffix = [
            // place file in a folder
            // if it's a base route
            path.includes("/") === false,
            // or path explicitly ends in a slash
            /\/$/.test(_path),
            // or route has dataLoader explicitly enabled
            opt?.dataLoader === true,
          ].some((e) => e)
            ? "/index.ts"
            : ".ts";

          const file = importPath + suffix;

          const paramsSchema = pathTokens.flatMap((e) => {
            return e.param ? [e.param] : [];
          });

          const fetchParamsLiteral = paramsSchema
            .map((param) => {
              return param.isRest
                ? `...${param.name}: Array<string | number>`
                : `${param.name}${param.isOpt ? "?" : ""}: string | number`;
            })
            .join(
              ", ", // intentionally using comma, do not use semicolon!
            );

          const paramsTypeId = ["ParamsT", crc32(importName)].join("");

          const template = opt?.apiTemplate
            ? await fsx.readFile(
                resolve(dirname(srcFile), opt.apiTemplate),
                "utf8",
              )
            : undefined;

          const route: ApiRoute = {
            base: opt?.base,
            path: join("/", path.replace(/^index\/?\b/, "")),
            pathTokens,
            originalPath,
            params: {
              id: paramsTypeId,
              literal: render(paramsTpl, { schema: paramsSchema }).trim(),
              schema: paramsSchema,
            },
            fetchParams: {
              id: paramsTypeId,
              literal: fetchParamsLiteral,
            },
            importName,
            importPath,
            srcFile,
            file,
            fileFullpath: resolve(config.root, defaults.apiDir, file),
            meta: opt?.meta,
            template,
            alias: routeAlias(opt),
          };

          entries.push({
            route,
          });
        }

        return entries;
      },
    });
  }

  return parsers;
}
