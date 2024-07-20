import { join } from "node:path";

import { mergeConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import apprilDevPlugin, { definePlugin } from "@appril/dev";

import { baseurl, apiurl } from "./config";
import baseConfig from "../vite.config";

export default async () => {
  return mergeConfig(await baseConfig(import.meta.dirname), {
    base: join(baseurl, "/"),
    plugins: [
      solidPlugin(),

      apprilDevPlugin({ apiurl, solidPages: {} }),

      definePlugin([
        {
          // keys extracted from process.env and exposed to client
          keys: ["NODE_ENV", "DEBUG"],
        },
        {
          file: "../.env",
          keys: ["HOSTNAME"], // keys exposed to client
          use(key, val) {
            process.env[key] = val;
          },
        },
      ]),
    ],
  });
};
