import { resolve } from "node:path";

import type { Plugin } from "vite";
import fsx from "fs-extra";
import { parse as dotenv } from "dotenv";

type Entry = {
  keys: string[];
  file?: string;
  defineOn?: string;
  use?: (key: string, val: string | undefined) => void;
};

const PLUGIN_NAME = "@appril:definePlugin";

export function definePlugin(entries: Entry[]): Plugin {
  const root = process.cwd();

  return {
    name: PLUGIN_NAME,

    async config() {
      const define: Record<string, unknown> = {};

      for (const { keys, file, defineOn = "process.env", use } of entries) {
        define[defineOn] = {};

        let env = process.env;

        if (file) {
          const path = resolve(root, file);

          if (!(await fsx.pathExists(path))) {
            continue;
          }

          env = dotenv(await fsx.readFile(path, "utf8"));
        }

        for (const [key, val] of Object.entries(env)) {
          if (keys.includes(key)) {
            // only explicitly given keys available on client
            define[`${defineOn}.${key}`] = JSON.stringify(val);
          }
          use?.(key, val);
        }
      }

      return { define };
    },
  };
}
