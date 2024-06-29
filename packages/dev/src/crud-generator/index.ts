import { join, resolve } from "node:path";

import type { ResolvedConfig } from "vite";
import glob from "fast-glob";
import fsx from "fs-extra";

import type { ResolvedPluginOptions, BootstrapPayload } from "../@types";
import type { CustomTemplates, Options, Table } from "./@types";
import { extractTables } from "./tables";
import { defaults } from "../defaults";

type Workers = typeof import("./workers");

export async function crudGenerator(
  config: ResolvedConfig,
  options: ResolvedPluginOptions,
  { workerPool }: { workerPool: Workers },
) {
  const { sortTemplates } = await import("@appril/crud/templates");

  const { sourceFolder, sourceFolderPath } = options;

  const {
    base,
    dbxConfig,
    schemas = ["public"],
  } = options.crudGenerator as Options;

  const tableMap: Record<string, Table> = {};

  const tplWatchers: Record<string, () => Promise<void>> = {};
  const schemaWatchers: Record<string, () => Promise<string>> = {};

  const customTemplates: CustomTemplates = {
    api: {},
    client: {},
  };

  const watchHandler = async (file: string) => {
    if (schemaWatchers[file]) {
      // updating tableMap
      const schema = await schemaWatchers[file]();

      // then feeding it to worker
      await workerPool.handleSchemaFileUpdate({
        schema,
        tables: Object.values(tableMap),
        customTemplates,
      });

      return;
    }

    if (tplWatchers[file]) {
      // updating customTemplates
      await tplWatchers[file]();

      // then feeding it to worker
      await workerPool.handleCustomTemplateUpdate({
        tables: Object.values(tableMap),
        customTemplates,
      });

      return;
    }

    for (const table of Object.values(tableMap)) {
      if (table.apiFileFullpath === file) {
        await workerPool.handleApiFileUpdate({
          table,
          customTemplates,
        });
        return;
      }
    }
  };

  // watching custom templates for updates
  for (const [key, map] of Object.entries(customTemplates) as [
    k: keyof CustomTemplates,
    v: Record<string, { file: string; content: string }>,
  ][]) {
    const optedTemplates = options.crudGenerator?.[`${key}Templates`];

    let customMap: Record<string, string> = {};

    if (typeof optedTemplates === "string") {
      const entries = await glob(join(optedTemplates, "**/*"), {
        cwd: sourceFolderPath,
        objectMode: true,
        absolute: false,
        onlyFiles: true,
        deep: 3,
      });

      for (const { name, path } of entries.sort(sortTemplates)) {
        customMap[name.replace(".hbs", "")] = path;
      }
    } else if (typeof optedTemplates === "object") {
      customMap = optedTemplates;
    }

    for (const [name, path] of Object.entries(customMap)) {
      const file = resolve(sourceFolderPath, path);
      tplWatchers[file] = async () => {
        map[name] = {
          file,
          content: await fsx.readFile(file, "utf8"),
        };
      };
    }
  }

  // watching schemas for added/removed tables
  for (const schema of schemas) {
    const file = resolve(
      sourceFolderPath,
      join("..", dbxConfig.base, schema, "index.ts"),
    );

    schemaWatchers[file] = async () => {
      const tables = await extractTables(config, options, schema);

      for (const table of tables) {
        tableMap[table.basename] = table;
      }

      return schema;
    };
  }

  // populating customTemplates for bootstrap
  for (const handler of Object.values(tplWatchers)) {
    await handler();
  }

  // pupulating tableMap for bootstrap
  for (const handler of Object.values(schemaWatchers)) {
    await handler();
  }

  const bootstrapPayload: BootstrapPayload<Workers> = {
    sourceFolder,
    sourceFolderPath,
    base,
    dbxBase: dbxConfig.base,
    tables: Object.values(tableMap),
    customTemplates,
  };

  return {
    bootstrapPayload,
    watchHandler,
    watchPatterns: [
      // watching custom templates
      ...Object.keys(tplWatchers),

      // also watching schema files for added/removed tables
      ...Object.keys(schemaWatchers),

      // also watching api files
      ...[`${resolve(sourceFolderPath, defaults.apiDir)}/**/*.ts`],
    ],
  };
}
