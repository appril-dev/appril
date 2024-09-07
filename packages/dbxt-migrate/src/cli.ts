import { resolve, join } from "node:path";
import { parseArgs } from "node:util";

import fsx from "fs-extra";
import colors from "kleur";
import initKnex, { type Knex } from "knex";
import { type BuildOptions, build as esbuild } from "esbuild";

import { defaults } from "@appril/configs";
import { resolveCwd } from "@appril/dev-utils";

import type { UserConfig, ResolvedConfig } from "./@types";

import generateKnexfile from "./migrations/knexfile";
import selectMigrations from "./migrations/select";
import createMigration from "./migrations/create";
import migrateFactory from "./migrations/run";

const usage = [
  "Basically a wrapper around Knex migrate API, with some Appril-specific niceties\n",
  "db-migrate [-c ./config/db.ts] create | up | down | latest | rollback | list | unlock | version | build",
  "db-migrate create                : Create a new migration file, interactively",
  "db-migrate up [name]             : Run the next (or the specified migration) that has not yet been run",
  "db-migrate up -s | --select      : Run selected migrations up",
  "db-migrate down [name]           : Undo the last (or the specified migration) that was already run",
  "db-migrate down -s | --select    : Run selected migrations down",
  "db-migrate latest                : Run all migrations that have not yet been run",
  "db-migrate rollback [-a | --all] : Rollback the last batch of migrations performed (or --all completed)",
  "db-migrate list                  : List all migrations files with status",
  "db-migrate unlock                : Forcibly unlocks the migrations lock table",
  "db-migrate version               : View the current version for the migration",
  "db-migrate build [-d | --dir]    : Build a production-ready knexfile, save it to ./ (or to --dir if provided)",
  "db-migrate -h | --help           : Print this message and exit",
];

const options = {
  config: {
    type: "string",
    short: "c",
  },
  select: {
    type: "boolean",
    short: "s",
  },
  dir: {
    type: "string",
    short: "d",
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
  } else {
    console.error(error);
    halt(1);
  }
}

async function run(
  parsedOptions: {
    config?: string;
    dir?: string;
    select?: boolean;
    all?: boolean;
    help?: boolean;
  },
  positionals: Array<string>,
) {
  // should run only inside app root
  const root = resolveCwd();

  // relative to root
  const configFile = resolve(
    root,
    join(
      defaults.baseDir,
      typeof parsedOptions.config === "string"
        ? parsedOptions.config
        : "./config/db.ts",
    ),
  );

  const esbuildConfig: BuildOptions = await import(
    resolve(root, "esbuild.json"),
    { with: { type: "json" } }
  ).then((e) => ({ ...e.default, sourcemap: "inline" }));

  const userConfig = await importFile<UserConfig>(configFile, {
    esbuildConfig,
    assertKeys: ["connection", "client", "baseDir", "migrationDir"],
  });

  const config: ResolvedConfig = {
    ...userConfig,
    migrationDirSuffix:
      typeof userConfig.migrationDirSuffix === "function"
        ? await userConfig.migrationDirSuffix()
        : userConfig.migrationDirSuffix || "",
  };

  const migrateTask = positionals[0] as
    | keyof Omit<ReturnType<typeof migrateFactory>, "batchRun">
    | "create"
    | "build";

  if (migrateTask === "create") {
    await createMigration(root, config);
    return;
  }

  if (migrateTask === "build") {
    const knexfile = await generateKnexfile(root, {
      config,
      esbuildConfig,
      outdir: parsedOptions.dir,
    });
    console.log(
      `\n  ◈ ${colors.magenta(knexfile.replace(root, "."))} ready to use in production ✨`,
    );
    return;
  }

  let knex: Knex | undefined;

  const knexfile = await generateKnexfile(root, {
    config,
    esbuildConfig,
    transient: true,
  });

  try {
    const knexConfig = await import(knexfile);
    knex = initKnex(knexConfig);
  } finally {
    await fsx.unlink(knexfile);
  }

  const { batchRun, ...migrateTasks } = migrateFactory(knex, {
    migrationName: positionals[1],
    rollbackAll: parsedOptions.all,
  });

  if (!migrateTasks[migrateTask]) {
    throw {
      haltMessage: [
        `Unknown migrate task: ${migrateTask}`,
        `Use one of: ${Object.keys(migrateTasks).join(" | ")}`,
      ],
    };
  }

  try {
    if (parsedOptions.select) {
      const [completed, pending]: [
        c: Array<{ name: string }>,
        p: Array<string>,
      ] = await knex.migrate.list();

      if (migrateTask === "up") {
        if (pending.length) {
          await batchRun(await selectMigrations(pending), "up");
        } else {
          console.log(colors.magenta("\n  ◈ No pending migrations ✨"));
        }
      } else if (migrateTask === "down") {
        if (completed.length) {
          await batchRun(
            await selectMigrations(completed.map((e) => e.name).reverse()),
            "down",
          );
        } else {
          console.log(colors.magenta("\n  ◈ No completed migrations yet"));
        }
      } else {
        throw { haltMessage: "--select works only with up/down tasks" };
      }
    } else {
      await migrateTasks[migrateTask]();
    }
  } finally {
    knex.destroy();
  }
}

function printUsage() {
  for (const line of usage) {
    console.log(line);
  }
}

async function importFile<T>(
  // absolute path
  file: string,
  {
    esbuildConfig,
    defaultExports,
    assertKeys,
  }: {
    esbuildConfig: BuildOptions;
    defaultExports?: boolean;
    assertKeys?: Array<keyof T>;
  },
): Promise<T> {
  const outfile = `${file}.${new Date().getTime()}.mjs`;

  await esbuild({
    ...esbuildConfig,
    bundle: true,
    entryPoints: [file],
    outfile,
    sourcemap: false,
    logLevel: "error",
  });

  let data: T;

  try {
    const exports = await import(outfile);
    data = defaultExports ? exports.default : exports;
  } finally {
    await fsx.unlink(outfile);
  }

  for (const key of assertKeys || []) {
    if (!data?.[key]) {
      throw {
        haltMessage: [
          `Incomplete config provided, ${String(key)} should be exported by`,
          file,
        ],
      };
    }
  }

  return data;
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
