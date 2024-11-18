import { dirname, join, resolve } from "node:path";
import { format } from "node:util";

import type { ResolvedConfig } from "vite";
import glob from "fast-glob";
import fsx from "fs-extra";
import { parse } from "smol-toml";

import {
  type PluginOptionsResolved,
  type RouteOptions,
  type SolidPage,
  normalizeRoutePath,
  pathTokensFactory,
  defaults,
  routeAlias,
  importNameFromPath,
} from "@/base";

type ParsedEntry = {
  page: SolidPage;
};

export async function sourceFilesParsers(
  config: ResolvedConfig,
  options: PluginOptionsResolved,
  pattern = `*${defaults.sourceFile}`,
) {
  const { sourceFolder } = options;

  const parsers: {
    file: string;
    parser: () => Promise<Array<ParsedEntry>>;
  }[] = [];

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
        const pageDefs = parse(await fsx.readFile(srcFile, "utf8"));

        const entries: Array<ParsedEntry> = [];

        for (const [_path, opt] of Object.entries(pageDefs) as Array<
          [path: string, opt: RouteOptions | undefined]
        >) {
          if (opt?.page === false) {
            continue;
          }

          const pathTokens = pathTokensFactory(
            normalizeRoutePath(_path),
            srcFile,
          );

          const originalPath = pathTokens.map((e) => e.orig).join("/");

          const path = pathTokens
            .map(({ param, orig, ext }) => {
              if (param) {
                if (param.isRest) {
                  return `*${param.name + ext}`;
                }
                const suffix = param.isOpt ? "?" : "";
                return `:${param.name + ext + suffix}`;
              }
              return orig;
            })
            .join("/");

          const importPath = originalPath;
          const importName = importNameFromPath(importPath);

          const suffix = /\/$/.test(_path) ? "/index.tsx" : ".tsx";

          const file = importPath + suffix;

          const dataLoaderGenerator: SolidPage["dataLoaderGenerator"] =
            opt?.dataLoader === true
              ? {
                  // relative path, worker would prepend libDir/pagesDir
                  datafile: originalPath,
                  // relative path, api generator would prepend apiDir
                  apiEndpoint: [originalPath, defaults.apiDataEndpoint].join(
                    "/",
                  ),
                }
              : undefined;

          let dataLoaderConsumer: SolidPage["dataLoaderConsumer"] | undefined;

          if (opt?.dataLoader) {
            if (opt.dataLoader === true) {
              dataLoaderConsumer = {
                importDatafile: [
                  sourceFolder,
                  format(defaults.libDirFormat, defaults.pagesDir),
                  originalPath,
                ].join("/"),
                importDatafunc: "dataCache",
                useData: true,
              };
            } else if (typeof opt.dataLoader === "string") {
              dataLoaderConsumer = {
                importDatafile: opt.dataLoader,
                importDatafunc: "default",
              };
            }
          }

          const paramsLiteral = pathTokens
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

          const template = opt?.pageTemplate
            ? await fsx.readFile(
                resolve(dirname(srcFile), opt.pageTemplate),
                "utf8",
              )
            : undefined;

          const page: SolidPage = {
            originalPath,
            path: join("/", path.replace(/^index\/?\b/, "")),
            pathTokens,
            file,
            fileFullpath: resolve(config.root, defaults.pagesDir, file),
            srcFile,
            importPath,
            importName,
            params: {
              literal: paramsLiteral,
            },
            dataLoaderGenerator,
            dataLoaderConsumer,
            meta: opt?.meta ? JSON.stringify(opt.meta) : undefined,
            template,
            alias: routeAlias(opt),
          };

          entries.push({
            page,
          });
        }

        return entries;
      },
    });
  }

  return parsers;
}
