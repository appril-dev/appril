import nopt from "nopt";
import chokidar from "chokidar";

import pgts from "@appril/pgts";
import { resolveCwd } from "@appril/dev-utils";

import typesGenerator from "./types";
import tablesGenerator from "./tables";

import { getConfig, run } from "../base";

const { config: configFile, mode } = nopt(
  {
    config: String,
    mode: ["once", "watch"],
  },
  {
    c: ["--config"],
    m: ["--mode"],
  },
);

const worker = async () => {
  const { plugins = [], ...config } = await getConfig(resolveCwd(configFile));

  for (const requiredParam of ["connection", "base"] as const) {
    if (!config[requiredParam]) {
      throw new Error(
        `Incomplete config provided, ${requiredParam} param missing`,
      );
    }
  }

  const data = await pgts(config.connection, {
    modulePrefix: "dbx",
    ...config,
  });

  for (const [label, generator] of [
    ["types", typesGenerator],
    ["tables", tablesGenerator],
  ] as const) {
    process.stdout.write(`  ➜ Generating ${label}... `);
    await generator(config, data);
    console.log("Done ✨");
  }

  for (const plugin of plugins) {
    await plugin(config, data);
  }

  if (mode === "watch") {
    console.log(`Watching ${configFile} for changes...`);
  }
};

if (mode === "watch") {
  worker().then(() => {
    const watcher = chokidar.watch(configFile);
    watcher.on("change", worker);
  });
} else {
  run(worker);
}
