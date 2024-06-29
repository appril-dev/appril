import { join, resolve } from "node:path";

import type { ResolvedConfig } from "vite";
// import pgts from "@appril/pgts";

import type {
  Options,
  Table,
  TableAlias,
  TableAssets,
  TableDeclaration,
} from "./@types";
import type { ResolvedPluginOptions } from "../@types";
import { defaults } from "../defaults";

export async function extractTables(
  config: ResolvedConfig,
  options: ResolvedPluginOptions,
  schema: string,
) {
  const { sourceFolderPath } = options;

  const {
    base,
    dbxConfig,
    alias = {},
    tableFilter,
    meta,
  } = options.crudGenerator as Options;

  const tableAssets = (
    table: TableDeclaration,
    { basename }: { basename: string },
  ): TableAssets => {
    const apiFile = join(base, basename, "index.ts");

    const partial: Omit<TableAssets, "meta"> = {
      basename,
      fetchBase: join(config.base, defaults.apiDir, base, basename),
      apiPath: join(base, basename),
      apiFile,
      apiFileFullpath: resolve(sourceFolderPath, defaults.apiDir, apiFile),
    };

    return {
      ...partial,
      // biome-ignore format:
      meta: typeof meta === "function"
        ? meta({ ...table, ...partial })
        : { ...meta?.["*"], ...meta?.[basename] },
    };
  };

  const tableFlatMapper = (table: TableDeclaration): Table[] => {
    const tables: Table[] = [];

    const assets = tableAssets(table, { basename: table.name });

    if (!tableFilter || tableFilter(table)) {
      if (!table.primaryKey) {
        console.log(`[ ${table.name} ] - no primaryKey defined, skipping...`);
        return [];
      }

      tables.push({
        ...table,
        ...assets,
      });
    }

    const aliases: string[] = [];

    if (typeof alias[table.name] === "string") {
      aliases.push(alias[table.name] as string);
    } else if (Array.isArray(alias[table.name])) {
      aliases.push(...(alias[table.name] as string[]));
    }

    for (const basename of aliases) {
      const tableAlias: TableAlias = {
        ...tableAssets(table, { basename }),
        aliasOf: assets.basename,
      };
      tables.push({ ...table, ...assets, ...tableAlias });
    }

    return tables;
  };

  const { default: pgts } = await import("@appril/pgts");

  const { tables } = await pgts(dbxConfig.connection, {
    ...dbxConfig,
    schemas: [schema],
  });

  return tables.flatMap(tableFlatMapper);
}
