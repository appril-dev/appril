import { join } from "node:path";

import { stringify } from "smol-toml";

import type { TableDeclaration, ColumnDeclaration } from "@appril/pgxt";
import { defaults } from "@appril/configs";
import { fileGenerator, render, resolveCwd } from "@appril/dev-utils";

import { type GeneratorPlugin, BANNER } from "@/base";
import { tablesDir } from "@/plugins/tables";

import publicIdTpl from "./templates/public/[id].hbs";
import publicIndexTpl from "./templates/public/index.hbs";

import tableIdTpl from "./templates/table/[id].hbs";
import tableIndexTpl from "./templates/table/index.hbs";
import tableTypeLiteralsTpl from "./templates/table/typeLiterals.hbs";

import enumTypeTpl from "./templates/types/enum.hbs";
import importTypeTpl from "./templates/types/import.hbs";

import indexTpl from "./templates/index.hbs";

type TableSetup = { dataLoader?: boolean };

export default (
  srcFolder: string,
  tableMap: Record<string, boolean | TableSetup>,
  config?: {
    // postgres schema name. only one schema per plugin call.
    // to generate for multiple schemas call plugin multiple times, once per schema.
    schema?: string;
    // folder name to place generated files into. defaults to crud
    baseDir?: string;
    // base url for routes. defaults to baseDir
    baseUrl?: string;
  },
): GeneratorPlugin => {
  const { schema = "public", baseDir = "crud", ...rest } = { ...config };

  const { baseUrl = baseDir } = rest;

  const varDir = `{${baseDir}}`;

  const root = resolveCwd();

  const { generateFile } = fileGenerator(root);

  return async function crudGenerator(data, pgxtConfig) {
    const tables = data.tables.flatMap((table) => {
      if (table.schema !== schema || !table.primaryKey) {
        return [];
      }
      return !tableMap || tableMap[table.name] ? [table] : [];
    });

    await generateFile(join(defaults.varDir, srcFolder, varDir, "index.ts"), {
      template: indexTpl,
      context: {},
    });

    for (const table of tables) {
      const typeLiterals: Array<string> = [];
      const columns: Array<ColumnDeclaration> = [];

      for (const col of table.columns) {
        let declaredType = col.declaredType;

        if (col.enumDeclaration) {
          typeLiterals.push(render(enumTypeTpl, col));
          declaredType = col.enumDeclaration.declaredName;
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
        varImportPath: `${srcFolder}/${varDir}/${table.name}`,
        tblImportPath: join(
          defaults.basePrefix,
          pgxtConfig.baseDir,
          table.schema,
          tablesDir,
          table.name,
        ),
      };

      for (const [file, template] of [
        ["[id].ts", tableIdTpl],
        ["index.ts", tableIndexTpl],
        ["typeLiterals.ts", tableTypeLiteralsTpl],
      ] as const) {
        await generateFile(
          join(defaults.varDir, srcFolder, varDir, table.name, file),
          { template, context },
        );
      }

      for (const [file, template] of [
        ["[id].ts", publicIdTpl],
        ["index.ts", publicIndexTpl],
      ] as const) {
        await generateFile(
          join(srcFolder, defaults.apiDir, baseUrl, table.name, file),
          { template, context, format: true },
          { overwrite: false },
        );
      }
    }

    const reducer = (map: Record<string, unknown>, table: TableDeclaration) => {
      let dataLoader: boolean | undefined;

      if (typeof tableMap?.[table.name] === "object") {
        dataLoader = (tableMap[table.name] as TableSetup).dataLoader;
      }

      const baseurl = join(baseUrl, table.name);

      map[`${baseurl}/`] = { dataLoader };

      map[`${baseurl}/[id]`] = {
        dataLoader: dataLoader ? { alias: baseurl } : undefined,
      };

      return map;
    };

    const content = [
      BANNER.trim().replace(/^/gm, "#"),
      stringify(tables.reduce(reducer, {})),
    ].join("\n");

    await generateFile(
      join(srcFolder, `_${baseDir + defaults.sourceFile}`),
      content,
    );
  };
};
