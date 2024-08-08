import { resolve } from "node:path";

import type { Plugin } from "vite";

const PLUGIN_NAME = "@appril:aliasPlugin";

export const aliasPlugin = async (srcdir: string): Promise<Plugin> => {
  const {
    default: { compilerOptions },
  } = await import(resolve(srcdir, "tsconfig.json"), {
    with: { type: "json" },
  });

  return {
    name: PLUGIN_NAME,

    async config() {
      return {
        resolve: {
          alias: Object.entries({ ...compilerOptions?.paths } as Record<
            string,
            Array<string>
          >).reduce(
            (
              aliases: Array<{ find: string; replacement: string }>,
              [find, paths],
            ) => {
              for (const path of paths) {
                aliases.push({
                  find: find.replace("/*", ""),
                  replacement: resolve(srcdir, path.replace("/*", "")),
                });
              }
              return aliases;
            },
            [],
          ),
        },
      };
    },
  };
};
