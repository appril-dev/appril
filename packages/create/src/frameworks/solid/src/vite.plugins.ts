import solidPlugin from "vite-plugin-solid";
import apprilDevPlugin, { definePlugin } from "@appril/dev";

import { apiurl } from "./config";

export default [
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
] satisfies import("vite").Plugin[];
