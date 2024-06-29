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
  pattern = `**/*${defaults.routerSourceFile}`,
) {
  const { sourceFolderPath } = options;

  const parsers: {
    file: string;
    parser: () => Promise<{ page: SolidPage }[]>;
  }[] = [];

  const srcFiles = await glob(pattern, {
    cwd: resolve(sourceFolderPath, defaults.routerDir),
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
            cfg?.dataLoader === true
              ? {
                  // relative path, worker would prepend varDir
                  datafile: join(defaults.apiDataDir, originalPath),
                  // relative path, api generator would prepend apiDir
                  apiEndpoint: [defaults.apiDataDir, originalPath].join("/"),
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
                      defaults.varPrefix,
                      defaults.apiDataDir,
                      originalPath,
                    ].join("/"),
                    importDatafunc: "dataCache",
                    useData: true,
                  }
              : undefined;

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
