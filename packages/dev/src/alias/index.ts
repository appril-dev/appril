import type { Alias, Plugin } from "vite";
import ts from "typescript";
import glob from "fast-glob";

const PLUGIN_NAME = "@appril:aliasPlugin";

export const aliasPlugin = async (appRoot: string): Promise<Plugin> => {
  const tsconfig = ts.getParsedCommandLineOfConfigFile(
    `${appRoot}/tsconfig.json`,
    undefined,
    ts.sys as never,
  );

  return {
    name: PLUGIN_NAME,

    config() {
      const aliasmap: Array<Alias> = [];

      const pathEntries = Object.entries({ ...tsconfig?.options?.paths });

      for (const [aliasPattern, pathPatterns] of pathEntries) {
        const alias = aliasPattern.replace("/*", "");
        const paths = pathPatterns.map((e) => e.replace("/*", ""));

        if (paths.length === 1) {
          aliasmap.push({
            find: new RegExp(`^${alias}/`),
            replacement: `${appRoot}/${paths[0]}/`,
          });
        } else if (paths.length > 1) {
          aliasmap.push({
            find: new RegExp(`^${alias}/`),
            replacement: "",
            async customResolver(_src) {
              const src = _src.replace(/(\$|\^|\+|\(|\)|\[|\])/g, "\\$1");

              const patterns = paths
                .sort((a, b) => a.split(/\/+/).length - b.split(/\/+/).length)
                .flatMap((e) => [`${e}/${src}.*`, `${e}/${src}/index.*`]);

              const [file] = await glob(patterns, {
                cwd: appRoot,
                onlyFiles: true,
                absolute: true,
                dot: true,
                followSymbolicLinks: false,
                braceExpansion: false,
                globstar: false,
                ignore: ["**/node_modules/**"],
              });

              return file;
            },
          });
        }
      }

      return {
        resolve: {
          alias: aliasmap,
        },
      };
    },
  };
};
