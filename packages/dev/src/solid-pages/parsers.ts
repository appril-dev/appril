import { join } from "node:path";

import { normalizePath, type ResolvedConfig } from "vite";
import glob from "fast-glob";
import fsx from "fs-extra";
import { parse } from "smol-toml";

import type { ResolvedPluginOptions, RouteOptions, SolidPage } from "../@types";

import { normalizeRoutePath, routeSections } from "../base";
import { defaults } from "../defaults";

export async function sourceFilesParsers(
  _config: ResolvedConfig,
  options: ResolvedPluginOptions,
  pattern = `*${defaults.sourceFile}`,
) {
  const { root } = options;

  const parsers: {
    file: string;
    parser: () => Promise<{ page: SolidPage }[]>;
  }[] = [];

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
        const pageDefs = parse(await fsx.readFile(srcFile, "utf8"));

        const entries: Array<{ page: SolidPage }> = [];

        for (const [_path, opt] of Object.entries(pageDefs) as Array<
          [path: string, opt: RouteOptions | undefined]
        >) {
          if (opt?.page === false) {
            continue;
          }

          const originalPath = normalizeRoutePath(_path);

          const sections = routeSections(originalPath);

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
                  // relative path, worker would prepend varDir
                  datafile: join(defaults.apiDataDir, originalPath),
                  // relative path, api generator would prepend apiDir
                  apiEndpoint: [defaults.apiDataDir, originalPath].join("/"),
                }
              : undefined;

          let dataLoaderConsumer: SolidPage["dataLoaderConsumer"] | undefined;

          if (opt?.dataLoader) {
            if (opt.dataLoader === true) {
              dataLoaderConsumer = {
                importDatafile: [
                  defaults.varPrefix,
                  defaults.apiDataDir,
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
                  defaults.varPrefix,
                  defaults.apiDataDir,
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

          const page: SolidPage = {
            path: path === "index" ? "/" : join("/", path),
            originalPath,
            file: originalPath + suffix,
            srcFile,
            importPath: originalPath,
            importName: originalPath.replace(/\W/g, "_"),
            dataLoaderGenerator,
            dataLoaderConsumer,
            link: {
              base: originalPath.replace(/^index\/?/, "/"),
              props: linkProps,
              replacements: JSON.stringify(linkReplcements),
            },
            meta: opt?.meta ? JSON.stringify(opt.meta) : undefined,
          };

          entries.push({ page });
        }

        return entries;
      },
    });
  }

  return parsers;
}
