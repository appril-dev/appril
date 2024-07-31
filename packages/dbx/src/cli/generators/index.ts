import nopt from "nopt";
import fsx from "fs-extra";
import pgts from "@appril/pgts";
import { resolveCwd } from "@appril/utils";

import typesPlugin from "./plugins/types";
import tablesPlugin from "./plugins/tables";

import { type GeneratorConfig, run } from "../base";

const { config: configFile } = nopt(
  {
    config: String,
  },
  {
    c: ["--config"],
  },
);

run(async () => {
  if (!(await fsx.pathExists(configFile))) {
    throw new Error(`Config file does not exists: ${configFile}`);
  }

  const {
    default: { plugins = [], ...config },
  }: { default: GeneratorConfig } = await import(resolveCwd(configFile));

  for (const requiredParam of ["connection", "base"] as const) {
    if (!config[requiredParam]) {
      throw new Error(
        `Incomplete config provided, ${requiredParam} param missing`,
      );
    }
  }

  const data = await pgts(config.connection, config);

  for (const [label, plugin] of [
    ["types", typesPlugin],
    ["tables", tablesPlugin],
  ] as const) {
    process.stdout.write(` 🡺 Generating ${label}... `);
    await plugin(config, data);
    console.log("Done ✨");
  }

  for (const plugin of plugins) {
    await plugin(config, data);
  }
});
