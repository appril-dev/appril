import { resolve } from "node:path";
import { parseArgs } from "node:util";

import fsx from "fs-extra";
import chokidar from "chokidar";
import { type BuildOptions, build as esbuild } from "esbuild";

import pgxt from "@appril/pgxt";
import { resolveCwd } from "@appril/dev-utils";

import type { Config } from "./base";

const usage = [
  "pgxt [-c ./pgxt.config.ts] [-w] [-h]",
  "pgxt               : Run generators/plugins",
  "pgxt -w | --watch  : Watch mode - rerun generators/plugins on config file update",
  "pgxt -h | --help   : Print this message and exit",
];

const options = {
  config: {
    type: "string",
    short: "c",
  },
  watch: {
    type: "boolean",
    short: "w",
  },
  help: {
    type: "boolean",
    short: "h",
  },
} as const;

try {
  const { values } = parseArgs({ options });
  values.help ? printUsage() : await run(values);
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
  parsedOptions: Partial<
    Record<keyof typeof options, string | boolean | undefined>
  >,
) {
  // should run only inside app root
  const root = resolveCwd();

  // relative to root
  const configFile = resolve(
    root,
    typeof parsedOptions.config === "string"
      ? parsedOptions.config
      : "./pgxt.config.ts",
  );

  const esbuildConfig: BuildOptions = await import(
    resolve(root, "esbuild.json"),
    { with: { type: "json" } }
  ).then((e) => e.default);

  const watchedFiles = [configFile];

  const worker = async () => {
    const config = await importFile<Config>(configFile, {
      esbuildConfig,
      defaultExports: true,
      assertKeys: ["connection", "baseDir"],
    });

    const {
      connection,
      baseDir,
      defaultSchema = "public",
      plugins,
      ...pgxtConfig
    } = config;

    const data = await pgxt(connection, pgxtConfig);

    try {
      for (const plugin of plugins || []) {
        process.stdout.write(`  ➜ Running ${plugin.name} plugin ... `);
        await plugin(data, { root, baseDir, defaultSchema });
        console.log("Done ✨");
      }

      if (parsedOptions.watch) {
        console.log(
          "Watch mode started! Watched files:",
          watchedFiles.map((e) => e.replace(root, ".")),
        );
      }
      // biome-ignore lint:
    } catch (error: any) {
      console.error(error);
    }
  };

  await worker();

  if (parsedOptions.watch) {
    const watcher = chokidar.watch(watchedFiles, {
      awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 250 },
    });
    watcher.on("change", worker);
  } else {
    halt();
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
