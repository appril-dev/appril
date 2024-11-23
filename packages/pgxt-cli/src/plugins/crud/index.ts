import { join } from "node:path";
import { format } from "node:util";

import { stringify } from "smol-toml";
import { defaults } from "@appril/configs";
import { fileGenerator, render } from "@appril/dev-utils";
import type { TableDeclaration, ColumnDeclaration } from "@appril/pgxt";

import { type GeneratorPlugin, BANNER } from "@/base";

import publicIdTpl from "./templates/public/[id].hbs";
import publicIndexTpl from "./templates/public/index.hbs";

import tableIdTpl from "./templates/table/[id].hbs";
import tableIndexTpl from "./templates/table/index.hbs";
import tableTypeLiteralsTpl from "./templates/table/typeLiterals.hbs";

import enumTypeTpl from "./templates/types/enum.hbs";
import importTypeTpl from "./templates/types/import.hbs";

import indexTpl from "./templates/index.hbs";

type TableSetup = {
  dataLoader?: boolean;
  page?: boolean;
  returning?: Array<string>;
  returningExclude?: Array<string>;
  exclude?: Array<string>;
};

export default (
  sourceFolderOrConfig:
    | string
    | {
        sourceFolder: string;
        // postgres schema name. only one schema per plugin call.
        // to generate for multiple schemas call plugin multiple times, once per schema.
        schema?: string;
        // folder name to place generated files into. defaults to crud
        baseDir?: string;
        // base url for routes. defaults to baseDir
        baseUrl?: string;
      },
  tableMap: Record<string, boolean | TableSetup>,
): GeneratorPlugin => {
  const {
    sourceFolder,
    schema = "public",
    baseDir = "crud",
    ...rest
  } = typeof sourceFolderOrConfig === "string"
    ? { sourceFolder: sourceFolderOrConfig }
    : { ...sourceFolderOrConfig };

  const { baseUrl = baseDir } = rest;

  return async function crudGenerator(data, pgxtConfig) {
    const { generateFile } = fileGenerator(pgxtConfig.root);

    const tables: Array<[t: TableDeclaration, s: TableSetup]> = [];

    for (const table of data.tables) {
      if (table.schema !== schema || !table.primaryKey) {
        continue;
      }
      if (!tableMap || tableMap[table.name]) {
        tables.push([
          table,
          typeof tableMap[table.name] === "object"
            ? (tableMap[table.name] as TableSetup)
            : {},
        ]);
      }
    }

    const libApiDir = format(defaults.libDirFormat, defaults.apiDir);

    await generateFile(
      join(defaults.libDir, sourceFolder, libApiDir, `${baseDir}.ts`),
      {
        template: indexTpl,
        context: {},
      },
    );

    for (const [table, setup] of tables) {
      const typeLiterals: Array<string> = [];
      const columns: Array<ColumnDeclaration> = [];

      for (const column of table.columns) {
        if (column.enumDeclaration) {
          typeLiterals.push(render(enumTypeTpl, column));
        } else if (column.importedType) {
          typeLiterals.push(render(importTypeTpl, column));
        }
        if (!setup.exclude || !setup.exclude.includes(column.name)) {
          columns.push(column);
        }
      }

      let recordColumns = [...columns];

      if (setup.returning) {
        recordColumns = columns.filter((e) => {
          return e.isPrimaryKey ? true : setup.returning?.includes(e.name);
        });
      } else if (setup.returningExclude) {
        recordColumns = columns.filter((e) => {
          return e.isPrimaryKey
            ? true
            : !setup.returningExclude?.includes(e.name);
        });
      }

      const context = {
        table,
        columns,
        recordColumns,
        typeLiterals,
        returning: setup.returning
          ? JSON.stringify(setup.returning)
          : undefined,
        returningExclude: setup.returningExclude
          ? JSON.stringify(setup.returningExclude)
          : undefined,
        importPathmap: {
          api: [sourceFolder, defaults.apiDir].join("/"),
          lib: [sourceFolder, libApiDir, table.name, baseDir].join("/"),
          libCrud: [
            defaults.appPrefix,
            defaults.libDir,
            sourceFolder,
            libApiDir,
            baseDir,
          ].join("/"),
          table: [
            defaults.appPrefix,
            format(defaults.libDirFormat, pgxtConfig.baseDir),
            table.fullName,
          ].join("/"),
        },
      };

      for (const [file, template] of [
        ["[id].ts", tableIdTpl],
        ["[id].tpl", publicIdTpl],
        ["index.ts", tableIndexTpl],
        ["index.tpl", publicIndexTpl],
        ["typeLiterals.ts", tableTypeLiteralsTpl],
      ] as const) {
        await generateFile(
          join(
            defaults.libDir,
            sourceFolder,
            libApiDir,
            table.name,
            baseDir,
            file,
          ),
          { template, context },
        );
      }
    }

    const relpathToLib = join("..", defaults.libDir, sourceFolder, libApiDir);

    const reducer = (
      map: Record<string, unknown>,
      [table, { page, dataLoader, returning, returningExclude, exclude }]: [
        TableDeclaration,
        TableSetup,
      ],
    ) => {
      const base = join(baseUrl, table.name);

      map[`${base}/`] = {
        dataLoader,
        page,
        apiTemplate: join(relpathToLib, table.name, baseDir, "index.tpl"),
        meta: { returning, returningExclude, exclude },
      };

      map[`${base}/[id]`] = {
        page: false,
        dataLoader: dataLoader ? { alias: base } : undefined,
        apiTemplate: join(relpathToLib, table.name, baseDir, "[id].tpl"),
        meta: { returning, returningExclude, exclude },
      };

      return map;
    };

    const content = [
      BANNER.trim().replace(/^/gm, "#"),
      stringify(tables.reduce(reducer, {})),
    ].join("\n");

    await generateFile(
      join(
        sourceFolder,
        [
          `_${baseDir}`,
          ...(schema === "public" ? [] : [`_${schema}`]),
          defaults.sourceFile,
        ].join(""),
      ),
      content,
    );
  };
};
