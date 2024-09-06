import type { Config } from "./@types";

export * from "./@types";
export { BANNER } from "./base";

export { default as typesPlugin } from "./plugins/types";
export { default as tablesPlugin } from "./plugins/tables";
export { default as crudPlugin } from "./plugins/crud";

export function defineConfig(config: Config): Config {
  return config;
}
