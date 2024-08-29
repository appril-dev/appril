import pgts from "@appril/pgts";

import type { Config } from "../base";
import typesGenerator from "./types";
import tablesGenerator from "./tables";

export default async (
  // absolute path
  root: string,
  { plugins = [], ...config }: Config,
) => {
  const data = await pgts(config.connection, {
    modulePrefix: "dbx",
    ...config,
  });

  for (const [label, generator] of [
    ["types", typesGenerator],
    ["tables", tablesGenerator],
  ] as const) {
    process.stdout.write(`  ➜ Generating ${label}... `);
    await generator(root, config, data);
    console.log("Done ✨");
  }

  for (const plugin of plugins) {
    await plugin(config, data);
  }
};
