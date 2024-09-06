import type { Alias, Plugin } from "vite";
import ts from "typescript";

import { defaults } from "@/base";

const PLUGIN_NAME = "@appril:aliasPlugin";

export const aliasPlugin = async (appRoot: string): Promise<Plugin> => {
  const tsconfig = ts.getParsedCommandLineOfConfigFile(
    `${appRoot}/tsconfig.json`,
    undefined,
    ts.sys as never,
  );

  return {
    name: PLUGIN_NAME,

    async config() {
      const alias = Object.entries({ ...tsconfig?.options?.paths } as Record<
        string,
        Array<string>
      >).reduce(
        (
          entries: Array<
            Alias & {
              // mandatorily sorting by length to have longer ones checked first
              priority: number;
            }
          >,
          [base, aliases],
        ) => {
          const basename = base.replace("/*", "");

          if (basename === defaults.appPrefix) {
            // handling { "@/*": ["./*", "./var/*"] } entry
            for (const alias of aliases) {
              if (alias.includes(`/${defaults.varDir}/`)) {
                // handling [ "./var/*" ] entry
                entries.push({
                  // find ^@/{dir}/
                  find: new RegExp(`^${basename}/(\\{[^}]+\\})/`),
                  // replace with appRoot/var/{dir}/
                  replacement: `${appRoot}/${defaults.varDir}/$1/`,
                  priority: basename.length + 25,
                });
              } else {
                // handling [ "./*" ] entry
                entries.push({
                  // find ^@/
                  find: new RegExp(`^${basename}/`),
                  // replace with appRoot/
                  replacement: `${appRoot}/`,
                  priority: basename.length,
                });
              }
            }

            return entries;
          }

          for (const alias of aliases) {
            // handling { "@src/*": ["./@src/*", "./var/@src/*"] } entry
            if (alias.includes(`/${defaults.varDir}/${base}`)) {
              // handling [ "./var/@src/*" ] entry
              entries.push({
                // find ^@src/{dir}/
                find: new RegExp(`^(${basename}/\\{[^}]+\\})/`),
                // replace with appRoot/var/@src/{dir}/
                replacement: `${appRoot}/${defaults.varDir}/$1/`,
                priority: basename.length + 25,
              });
            } else {
              // handling [ "./@src/*" ] entry
              entries.push({
                // find ^@src/
                find: new RegExp(`^${basename}/`),
                // replace with appRoot/@src/
                replacement: `${appRoot}/${basename}/`,
                priority: basename.length,
              });
            }
          }

          return entries;
        },
        [],
      );

      return {
        resolve: {
          alias: alias.sort((a, b) => b.priority - a.priority),
        },
      };
    },
  };
};
