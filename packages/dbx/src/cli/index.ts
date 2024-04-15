import { merge } from "lodash-es";
import { config as pgtsConfig } from "@appril/pgts";

import defaultConfig from "./config";
import type { Config } from "./@types";

export * from "./@types";

export function defineConfig(config: Config): Required<Config> {
  return merge({}, defaultConfig, pgtsConfig, config) as Required<Config>;
}
