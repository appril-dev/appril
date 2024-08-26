import nopt from "nopt";
import { resolveCwd } from "@appril/dev-utils";

import { getConfig, run } from "../base";

import createMigration from "./create";
import generateKnexfile from "./knexfile";

const { config: configFile, action } = nopt(
  {
    config: String,
    action: String,
  },
  {
    c: ["--config"],
    a: ["--action"],
  },
);

run(async () => {
  const config = await getConfig(resolveCwd(configFile));

  for (const requiredParam of [
    "connection",
    "client",
    "base",
    "migrationDir",
  ] as const) {
    if (!config[requiredParam]) {
      throw new Error(
        `Incomplete config provided, ${requiredParam} param missing`,
      );
    }
  }

  if (action === "create") {
    await createMigration(config);
    return;
  }

  if (action === "knexfile") {
    await generateKnexfile(configFile, config);
    return;
  }

  throw new Error(`Unknown action: ${action}`);
});
