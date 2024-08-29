import { resolve, join } from "node:path";
import { parseArgs } from "node:util";

import fsx from "fs-extra";
import chokidar from "chokidar";
import initKnex, { type Knex } from "knex";
import { type BuildOptions, build as esbuild } from "esbuild";

import { resolveCwd } from "@appril/dev-utils";

import type { Config } from "./base";

import generators from "./generators";
import generateKnexfile from "./migrations/knexfile";
import createMigration from "./migrations/create";
import migrateTasks from "./migrations/run";

const migrateOpts = [...Object.keys(migrateTasks), "create", "compile"];

const usage = [
  "dbx [-c ./dbx.config.ts] [-g] [-w] [-m ...]",
  "dbx -g                           : Run generators/plugins",
  "dbx -w                           : Watch mode - rerun generators/plugins on config file update",
  "dbx -m create                    : Create a new migration file",
  "dbx -m up|down|latest|rollback   : Run given migration task",
  "dbx -m list                      : List all migrations files with status",
  "dbx -m unlock                    : Forcibly unlocks the migrations lock table",
  "dbx -m version                   : View the current version for the migration",
  "dbx -m compile                   : Compile migration files into a production-ready knexfile",
  "If -g/-w provided, -m are ignored",
];

const options = {
  config: {
    type: "string",
    short: "c",
  },
  generate: {
    type: "boolean",
    short: "g",
  },
  watch: {
    type: "boolean",
    short: "w",
  },
  migrate: {
    type: "string",
    short: "m",
  },
  all: {
    type: "boolean",
    short: "a",
  },
  help: {
    type: "boolean",
    short: "h",
  },
} as const;

try {
  const { values, positionals } = parseArgs({
    options,
    allowPositionals: true,
  });

  values.help ? printUsage() : await run(values, positionals);

  // biome-ignore lint:
} catch (error: any) {
  if (error.haltMessage) {
    halt(1, error.haltMessage);
  } else if (error.message) {
    halt(1, [error.message]);
  } else {
    console.error(error);
    halt(1);
  }
}

async function run(
  parsedOptions: Record<keyof typeof options, string | boolean | undefined>,
  positionals: Array<string>,
) {
  // should run only inside app root
  const root = resolveCwd();

  // relative to root
  const dbxfile =
    typeof parsedOptions.config === "string"
      ? parsedOptions.config
      : "./dbx.config.ts";

  const esbuildConfig = await loadEsbuildConfig(root);
  const dbxConfig = await loadDbxConfig(root, dbxfile, esbuildConfig);

  for (const requiredParam of [
    "connection",
    "client",
    "base",
    "migrationDir",
  ] as const) {
    if (!dbxConfig[requiredParam]) {
      throw {
        haltMessage: [
          "Incomplete config provided",
          `${dbxfile} default export should contain ${requiredParam} param`,
        ],
      };
    }
  }

  if (parsedOptions.generate || parsedOptions.watch) {
    const generatorsWorker = async () => {
      try {
        await generators(root, dbxConfig);
        if (parsedOptions.watch) {
          console.log(`Watching ${dbxfile} for changes...`);
        }
        // biome-ignore lint:
      } catch (error: any) {
        console.error(error);
      }
    };

    await generatorsWorker();

    if (parsedOptions.watch) {
      const watcher = chokidar.watch(resolve(root, dbxfile));
      watcher.on("change", generatorsWorker);
    } else {
      halt();
    }
    // if -g/-w provided, -m are ignored
  } else if (parsedOptions.migrate) {
    if (!migrateOpts.includes(parsedOptions.migrate as string)) {
      throw {
        haltMessage: [
          `Unknown migrate task: ${parsedOptions.migrate}`,
          `Use one of: ${migrateOpts.join(" | ")}`,
        ],
      };
    }

    if (parsedOptions.migrate === "create") {
      await createMigration(root, dbxConfig);
      halt();
    }

    const packageJson = await loadPackageJson(root);

    if (!packageJson.distDir) {
      throw {
        haltMessage: [
          "package.json has no distDir key",
          `Is ${root} an Appril app?`,
        ],
      };
    }

    // relative to root
    const knexfile = join(packageJson.distDir, "knexfile.mjs");

    await generateKnexfile(root, dbxConfig, esbuildConfig, {
      dbxfile,
      outfile: knexfile,
    });

    if (parsedOptions.migrate === "compile") {
      console.log("Migration files successfully compiled ✨");
      console.log(`Resulting knexfile can be used in production: ${knexfile}`);
      halt();
    }

    const knexConfig: Knex.Config = await import(resolve(root, knexfile));

    const knex = initKnex(knexConfig);

    try {
      await migrateTasks[parsedOptions.migrate as keyof typeof migrateTasks](
        knex,
        {
          migrationName: positionals[0],
          rollbackAll: parsedOptions.all as boolean,
        },
      );
    } finally {
      knex.destroy();
    }
  } else {
    printUsage();
  }
}

function printUsage() {
  for (const line of usage) {
    console.log(line);
  }
}

async function loadPackageJson(root: string): Promise<Record<string, string>> {
  try {
    const exports = await import(resolve(root, "package.json"), {
      with: { type: "json" },
    });
    return exports.default;
    // biome-ignore lint:
  } catch (error: any) {
    throw {
      haltMessage: [
        "Failed loading package.json",
        `Is ${root} an Appril app?`,
        error.message,
      ],
    };
  }
}

async function loadEsbuildConfig(root: string): Promise<BuildOptions> {
  try {
    const exports: { default: BuildOptions } = await import(
      resolve(root, "esbuild.json"),
      { with: { type: "json" } }
    );
    return exports.default;
    // biome-ignore lint:
  } catch (error: any) {
    throw {
      haltMessage: ["Failed loading esbuild.json", `Is ${root} an Appril app?`],
    };
  }
}

async function loadDbxConfig(
  // absolute path
  root: string,
  // relative to root
  dbxfile: string,
  esbuildConfig: BuildOptions,
): Promise<Config> {
  const outfile = resolve(root, `${dbxfile}.${new Date().getTime()}.mjs`);

  await esbuild({
    ...esbuildConfig,
    bundle: true,
    entryPoints: [dbxfile],
    outfile,
    sourcemap: false,
    logLevel: "error",
  });

  try {
    const exports = await import(outfile);
    return exports.default;
    // biome-ignore lint:
  } catch (error: any) {
    throw {
      haltMessage: [
        "Failed loading dbx config",
        `Is ${dbxfile} a valid dbx config file?`,
        error.message,
      ],
    };
  } finally {
    await fsx.unlink(outfile);
  }
}

function halt(exitCode = 0, logs?: string | Array<string>) {
  const logEntries = Array.isArray(logs)
    ? logs.entries()
    : logs
      ? [logs].entries()
      : [];

  for (const [i, log] of logEntries || []) {
    if (i === 0 && exitCode > 0) {
      console.error(`ERROR: ${log}`);
    } else {
      console.log(log);
    }
  }

  process.exit(exitCode);
}
