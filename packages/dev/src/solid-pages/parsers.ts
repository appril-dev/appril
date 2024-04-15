import { join, resolve } from "node:path";

import type { ResolvedConfig } from "vite";
import glob from "fast-glob";
import { parse } from "smol-toml";
import fsx from "fs-extra";

import type {
  ResolvedPluginOptions,
  SolidPageConfig,
  SolidPage,
} from "../@types";

import { normalizeRoutePath, routeSections } from "../base";
import { defaults } from "../defaults";

export async function sourceFilesParsers(
  _config: ResolvedConfig,
  options: ResolvedPluginOptions,
  pattern = `**/*${defaults.solidPages.sourceFile}`,
) {
  const { sourceFolderPath, routerDir } = options;

  const parsers: {
    file: string;
    parser: () => Promise<{ page: SolidPage }[]>;
  }[] = [];

  const srcFiles = await glob(pattern, {
    cwd: resolve(sourceFolderPath, routerDir),
    onlyFiles: true,
    absolute: true,
    unique: true,
  });

  for (const srcFile of srcFiles) {
    parsers.push({
      file: srcFile,
      async parser() {
        const pageDefs = parse(await fsx.readFile(srcFile, "utf8"));

        const entries: { page: SolidPage }[] = [];

        for (const [_path, cfg] of Object.entries(pageDefs) as [
          string,
          SolidPageConfig,
        ][]) {
          const originalPath = normalizeRoutePath(_path);

          const sections = routeSections(originalPath);

          const path = sections
            .map((e) => {
              if (e.param) {
                if (e.param.isAny) {
                  return `*${e.param.name + e.ext}`;
                }
                const suffix = e.param.isOpt ? "?" : "";
                return `:${e.param.name + e.ext + suffix}`;
              }
              return e.orig;
            })
            .join("/");

          const suffix = /\/$/.test(_path) ? "/index.tsx" : ".tsx";

          const dataLoaderGenerator: SolidPage["dataLoaderGenerator"] =
            cfg?.dataLoader === true
              ? {
                  // relative path, worker would prepend varDir
                  datafile: join(defaults.generated.data, originalPath),
                  // relative path, api generator would prepend apiDir
                  apiEndpoint: [defaults.generated.data, originalPath].join(
                    "/",
                  ),
                }
              : undefined;

          const dataLoaderConsumer: SolidPage["dataLoaderConsumer"] =
            cfg?.dataLoader
              ? typeof cfg.dataLoader === "string"
                ? {
                    importDatafile: cfg.dataLoader,
                    importDatafunc: "default",
                  }
                : {
                    importDatafile: [
                      defaults.generated.data,
                      originalPath,
                    ].join("/"),
                    importDatafunc: "dataCache",
                    importFetchfile: [
                      defaults.generated.fetch,
                      defaults.generated.data,
                      originalPath,
                    ].join("/"),
                    useData: true,
                  }
              : undefined;

          const linkProps = sections
            .slice(1)
            .flatMap((e) => {
              if (e.param) {
                if (e.param.isAny) {
                  return [`...${e.param.name}: (string | number)[]`];
                }
                const suffix = e.param.isOpt ? "?" : "";
                return [`${e.param.name + suffix}: string | number`];
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
            meta: cfg?.meta ? JSON.stringify(cfg.meta) : undefined,
          };

          entries.push({ page });
        }

        return entries;
      },
    });
  }

  return parsers;
}
