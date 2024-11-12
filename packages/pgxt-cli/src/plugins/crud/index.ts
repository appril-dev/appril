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

type TableSetup = { dataLoader?: boolean; page?: boolean };

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

    const tables = data.tables.flatMap((table) => {
      if (table.schema !== schema || !table.primaryKey) {
        return [];
      }
      return !tableMap || tableMap[table.name] ? [table] : [];
    });

    const libBaseDir = format(defaults.libDirFormat, baseDir);

    await generateFile(
      join(defaults.libDir, sourceFolder, libBaseDir, "index.ts"),
      {
        template: indexTpl,
        context: {},
      },
    );

    for (const table of tables) {
      const typeLiterals: Array<string> = [];
      const columns: Array<ColumnDeclaration> = [];

      for (const col of table.columns) {
        let declaredType = col.declaredType;

        if (col.enumDeclaration) {
          typeLiterals.push(render(enumTypeTpl, col));
        } else if (col.importedType) {
          typeLiterals.push(render(importTypeTpl, col));
          declaredType = col.importedType.isArray
            ? `Array<${col.importedType.import}>`
            : col.importedType.import;
        }

        columns.push({
          // do not alter column itself as it is a shallow copy!
          // rather use destructuring
          ...col,
          declaredType,
        });
      }

      const context = {
        table,
        columns,
        typeLiterals,
        importPathmap: {
          lib: [sourceFolder, libBaseDir, table.name].join("/"),
          table: [
            defaults.appPrefix,
            format(defaults.libDirFormat, pgxtConfig.baseDir),
            table.fullName,
          ].join("/"),
          tableApi: [
            sourceFolder,
            format(defaults.libDirFormat, defaults.apiDir),
            table.name,
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
          join(defaults.libDir, sourceFolder, libBaseDir, table.name, file),
          { template, context },
        );
      }
    }

    const relpathToLib = join("..", defaults.libDir, sourceFolder, libBaseDir);

    const reducer = (map: Record<string, unknown>, table: TableDeclaration) => {
      let page: boolean | undefined;
      let dataLoader: boolean | undefined;

      if (typeof tableMap?.[table.name] === "object") {
        page = (tableMap[table.name] as TableSetup).page;
        dataLoader = (tableMap[table.name] as TableSetup).dataLoader;
      }

      const base = join(baseUrl, table.name);

      map[`${base}/`] = {
        dataLoader,
        page,
        apiTemplate: join(relpathToLib, table.name, "index.tpl"),
      };

      map[`${base}/[id]`] = {
        page: false,
        dataLoader: dataLoader ? { alias: base } : undefined,
        apiTemplate: join(relpathToLib, table.name, "[id].tpl"),
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
