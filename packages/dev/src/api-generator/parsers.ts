import { join, resolve } from "node:path";

import glob from "fast-glob";
import fsx from "fs-extra";
import crc32 from "crc/crc32";
import { parse } from "smol-toml";
import { sanitizePath } from "@appril/utils";

import { normalizeRoutePath, routeSections, defaults } from "../base";

import type {
  ResolvedPluginOptions,
  ApiRouteConfig,
  ApiRoute,
  ApiRouteAlias,
} from "../@types";

type ParsedEntry = {
  routeConfig?: ApiRouteConfig;
  route: ApiRoute;
  alias: ApiRouteAlias[];
};

export async function sourceFilesParsers(
  _config: import("vite").ResolvedConfig,
  options: ResolvedPluginOptions,
  pattern = `**/*${defaults.apiSourceFile}`,
) {
  const { sourceFolderPath } = options;

  const parsers: {
    file: string;
    parser: () => Promise<ParsedEntry[]>;
  }[] = [];

  const srcFiles = await glob(pattern, {
    cwd: resolve(sourceFolderPath, defaults.apiDir),
    onlyFiles: true,
    absolute: true,
    unique: true,
  });

  for (const srcFile of srcFiles) {
    parsers.push({
      file: srcFile,
      async parser() {
        const routeDefs = parse(await fsx.readFile(srcFile, "utf8"));

        const entries: ParsedEntry[] = [];

        for (const [_path, cfg] of Object.entries(routeDefs) as [
          string,
          ApiRouteConfig | undefined,
        ][]) {
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

          const importPath = cfg?.file
            ? sanitizePath(cfg.file).replace(/\.[^.]+$/, "")
            : originalPath;

          const importName = importNameFromPath(importPath);

          const prefix = cfg?.prefix;

          const suffix = cfg?.file
            ? sanitizePath(cfg.file).replace(/.+(\.[^.]+)$/, "$1")
            : /\/$/.test(_path) || !path.includes("/")
              ? "/index.ts"
              : ".ts";

          const file = importPath + suffix;

          let template = cfg?.template;

          if (template) {
            // templates provided by routes are not watched for updates,
            // reading them once at source file parsing
            template = await fsx.readFile(
              /^\//.test(template)
                ? template
                : resolve(sourceFolderPath, template),
              "utf8",
            );
          }

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
            prefix,
            path: path === "index" ? "/" : join("/", path),
            originalPath,
            paramsType: paramsType || "[key: string|number]: unknown",
            fetchParamsType,
            importName,
            importPath,
            srcFile,
            file,
            fileFullpath: resolve(sourceFolderPath, defaults.apiDir, file),
            optedFile: cfg?.file,
            meta: cfg?.meta,
            template,
            templateContext: cfg?.templateContext,
          };

          const alias: ApiRouteAlias[] = [];
          const aliasOf = route.path;

          if (Array.isArray(cfg?.alias)) {
            for (const e of cfg.alias) {
              if (typeof e === "string") {
                alias.push({
                  aliasOf,
                  prefix,
                  path: e,
                  originalPath: e,
                  importName: importNameFromPath(importPath + e),
                });
              } else if (typeof e === "object") {
                alias.push({
                  aliasOf,
                  prefix,
                  path: path.replace(e.find, e.replace),
                  originalPath: originalPath.replace(e.find, e.replace),
                  importName: importNameFromPath(
                    importPath.replace(e.find, e.replace),
                  ),
                });
              }
            }
          } else if (typeof cfg?.alias === "object") {
            alias.push({
              aliasOf,
              prefix,
              path: path.replace(cfg.alias.find, cfg.alias.replace),
              originalPath: originalPath.replace(
                cfg.alias.find,
                cfg.alias.replace,
              ),
              importName: importNameFromPath(
                importPath.replace(cfg.alias.find, cfg.alias.replace),
              ),
            });
          } else if (typeof cfg?.alias === "string") {
            alias.push({
              aliasOf,
              prefix,
              path: cfg.alias,
              originalPath: cfg.alias,
              importName: importNameFromPath(importPath + cfg.alias),
            });
          }

          entries.push({ routeConfig: cfg, route, alias });
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
