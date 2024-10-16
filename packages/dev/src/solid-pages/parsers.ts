import { dirname, join, resolve } from "node:path";
import { format } from "node:util";

import { normalizePath, type ResolvedConfig } from "vite";
import glob from "fast-glob";
import fsx from "fs-extra";
import { parse } from "smol-toml";

import {
  type PluginOptionsResolved,
  type RouteOptions,
  type SolidPage,
  normalizeRoutePath,
  routeSections,
  defaults,
} from "@/base";

export async function sourceFilesParsers(
  config: ResolvedConfig,
  options: PluginOptionsResolved,
  pattern = `*${defaults.sourceFile}`,
) {
  const { sourceFolder } = options;

  const parsers: {
    file: string;
    parser: () => Promise<{ page: SolidPage }[]>;
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

        const entries: Array<{ page: SolidPage }> = [];

        for (const [_path, opt] of Object.entries(pageDefs) as Array<
          [path: string, opt: RouteOptions | undefined]
        >) {
          if (opt?.page === false) {
            continue;
          }

          const sections = routeSections(normalizeRoutePath(_path), srcFile);
          const originalPath = sections.map((e) => e.orig).join("/");

          const path = sections
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

          const suffix = /\/$/.test(_path) ? "/index.tsx" : ".tsx";

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
            } else if (typeof opt.dataLoader?.alias === "string") {
              dataLoaderConsumer = {
                importDatafile: [
                  sourceFolder,
                  format(defaults.libDirFormat, defaults.pagesDir),
                  normalizePath(opt.dataLoader.alias),
                ].join("/"),
                importDatafunc: "dataCache",
                useData: true,
              };
            }
          }

          const linkProps = sections
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

          const linkReplcements = sections.slice(1).flatMap((e, i) => {
            if (e.param) {
              return [[e.orig, i]];
            }
            return [];
          });

          const template = opt?.pageTemplate
            ? await fsx.readFile(
                resolve(dirname(srcFile), opt.pageTemplate),
                "utf8",
              )
            : undefined;

          const page: SolidPage = {
            path: join("/", path.replace(/^index\/?\b/, "")),
            originalPath,
            file: originalPath + suffix,
            srcFile,
            importPath: originalPath,
            importName: originalPath.replace(/\W/g, "_"),
            dataLoaderGenerator,
            dataLoaderConsumer,
            link: {
              base: originalPath.replace(/^index\/?\b/, "/"),
              props: linkProps,
              replacements: JSON.stringify(linkReplcements),
            },
            meta: opt?.meta ? JSON.stringify(opt.meta) : undefined,
            template,
          };

          entries.push({ page });
        }

        return entries;
      },
    });
  }

  return parsers;
}
