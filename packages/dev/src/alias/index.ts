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

    config() {
      const aliasmap: Array<
        Alias & {
          // mandatorily sorting by length to have longer ones checked first
          priority: number;
        }
      > = [];

      const pathEntries = Object.entries({ ...tsconfig?.options?.paths });

      for (const [base, paths] of pathEntries) {
        const basename = base.replace("/*", "");

        if (basename === defaults.basePrefix) {
          // handling { "@/*": ["./*", "./var/*"] } entry
          for (const path of paths) {
            if (path.includes(`/${defaults.varDir}/`)) {
              // handling [ "./var/*" ] entry
              aliasmap.push({
                // find ^@/{dir}/?
                find: new RegExp(`^${basename}/(\\{[^}]+\\})/?`),
                // replace with appRoot/var/{dir}/
                replacement: `${appRoot}/${defaults.varDir}/$1/`,
                priority: basename.length + 25,
              });
            } else {
              // handling [ "./*" ] entry
              aliasmap.push({
                // find ^@/
                find: new RegExp(`^${basename}/`),
                // replace with appRoot/base/
                replacement: `${appRoot}/${defaults.baseDir}/`,
                priority: basename.length,
              });
            }
          }
        } else {
          for (const path of paths) {
            // handling { "@src/*": ["./@src/*", "./var/@src/*"] } entry
            if (path.includes(`/${defaults.varDir}/${base}`)) {
              // handling [ "./var/@src/*" ] entry
              aliasmap.push({
                // find ^@src/{dir}/?
                find: new RegExp(`^(${basename}/\\{[^}]+\\})/?`),
                // replace with appRoot/var/@src/{dir}/
                replacement: `${appRoot}/${defaults.varDir}/$1/`,
                priority: basename.length + 25,
              });
            } else if (path === `./${base}`) {
              // handling [ "./@src/*" ] entry
              aliasmap.push({
                // find ^@src/
                find: new RegExp(`^${basename}/`),
                // replace with appRoot/@src/
                replacement: `${appRoot}/${basename}/`,
                priority: basename.length,
              });
            } else {
              aliasmap.push({
                find: new RegExp(`^${basename}/`),
                replacement: `${appRoot}/${path.replace(/\*$/, "")}`,
                priority: basename.length,
              });
            }
          }
        }
      }

      return {
        resolve: {
          alias: aliasmap.sort((a, b) => b.priority - a.priority),
        },
      };
    },
  };
};
