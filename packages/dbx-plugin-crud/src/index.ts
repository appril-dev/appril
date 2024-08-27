import { resolve, join } from "node:path";

import fsx from "fs-extra";
import { stringify } from "smol-toml";

import {
  type GeneratorPlugin,
  type TableDeclaration,
  type ColumnDeclaration,
  BANNER,
} from "@appril/dbx-cli";

import { defaults } from "@appril/dev";
import { fileGenerator, render, resolveCwd } from "@appril/dev-utils";

import publicIdTpl from "./templates/public/[id].hbs";
import publicIndexTpl from "./templates/public/index.hbs";

import tableIdTpl from "./templates/table/[id].hbs";
import tableIndexTpl from "./templates/table/index.hbs";
import tableTypeLiteralsTpl from "./templates/table/typeLiterals.hbs";

import enumTypeTpl from "./templates/types/enum.hbs";
import importTypeTpl from "./templates/types/import.hbs";

import indexTpl from "./templates/index.hbs";

export default (
  srcdir: string,
  config?: {
    // postgres schema name. only one schema per plugin call.
    // to generate for multiple schemas call plugin multiple times, once per schema.
    schema?: string;
    // folder name to place generated files into. defaults to crud
    basedir?: string;
    // base url for routes. defaults to basedir
    base?: string;
    tableFilter?: (name: string, context: TableDeclaration) => boolean;
    dataLoader?: boolean | Record<string, boolean>;
  },
): GeneratorPlugin => {
  const { schema = "public", basedir = "crud", ...rest } = { ...config };
  const { base = basedir, tableFilter } = rest;

  for (const path of [base, basedir]) {
    if (/\/|\\/.test(path)) {
      console.error(
        `\n\t[ Invalid CRUD Config ]: Some of "basedir" or "base" contains slashes\n`,
      );
      process.exit(1);
    }
  }

  const root = resolveCwd();

  const { generateFile } = fileGenerator(root);

  return async (dbxConfig, data) => {
    process.stdout.write("  ➜ Generating CRUD api... ");

    const tables = data.tables.flatMap((table) => {
      if (table.schema !== schema || !table.primaryKey) {
        return [];
      }
      return !tableFilter || tableFilter(table.name, table) ? [table] : [];
    });

    await generateFile(join(srcdir, defaults.varDir, basedir, "index.ts"), {
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
          const file = [
            col.importedType.from.startsWith(`${defaults.appPrefix}/`)
              ? col.importedType.from.replace(defaults.appPrefix, root)
              : resolve(root, col.importedType.from),
            ".ts",
          ].join("");

          if (await fsx.exists(file)) {
            typeLiterals.push(render(importTypeTpl, col));
            declaredType = col.importedType.isArray
              ? `Array<${col.importedType.import}>`
              : col.importedType.import;
          }
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
        dbxImportPath: `${defaults.appPrefix}/${dbxConfig.base}/${table.schema}/tables/${table.name}`,
        varImportPath: `${defaults.varPrefix}/${basedir}/${table.name}`,
      };

      for (const [file, template] of [
        ["[id].ts", tableIdTpl],
        ["index.ts", tableIndexTpl],
        ["typeLiterals.ts", tableTypeLiteralsTpl],
      ] as const) {
        await generateFile(
          join(srcdir, defaults.varDir, basedir, table.name, file),
          { template, context },
        );
      }

      for (const [file, template] of [
        ["[id].ts", publicIdTpl],
        ["index.ts", publicIndexTpl],
      ] as const) {
        await generateFile(
          join(srcdir, defaults.apiDir, base, table.name, file),
          { template, context, format: true },
          { overwrite: false },
        );
      }
    }

    const reducer = (map: Record<string, unknown>, table: TableDeclaration) => {
      let dataLoader: boolean | undefined;

      if (config?.dataLoader === true) {
        dataLoader = true;
      } else if (typeof config?.dataLoader === "object") {
        dataLoader = config?.dataLoader[table.name];
      }

      const baseurl = join(base, table.name);

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
      join(srcdir, `_${basedir + defaults.sourceFile}`),
      content,
    );

    console.log("Done ✨");
  };
};
