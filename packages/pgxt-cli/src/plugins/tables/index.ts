import { join } from "node:path";
import { format } from "node:util";

import { defaults } from "@appril/configs";
import { fileGenerator } from "@appril/dev-utils";
import type { TableDeclaration, ViewDeclaration } from "@appril/pgxt";

import { BANNER, tablesDir, typesDir, type GeneratorPlugin } from "@/base";

import baseTpl from "./templates/base.hbs";
import tableTpl from "./templates/table.hbs";
import indexTpl from "./templates/index.hbs";

export default (): GeneratorPlugin => {
  return async function tablesGenerator(
    { schemas, tables, views },
    { root, baseDir, defaultSchema },
  ) {
    const { generateFile } = fileGenerator(root);

    for (const table of [
      ...tables.map((e) => ({ ...e, isTable: true })),
      ...views,
    ]) {
      const schemaDir = table.schema === defaultSchema ? "" : table.schema;
      const libBaseDir = format(defaults.libDirFormat, baseDir);

      const context = {
        table,
        defaults,
        importPathmap: {
          setup: [defaults.appPrefix, baseDir, "setup"].join("/"),
          tables: [defaults.appPrefix, libBaseDir].join("/"),
          types: [
            defaults.appPrefix,
            baseDir,
            ...(schemaDir ? [schemaDir] : []),
            typesDir,
          ].join("/"),
        },
      };

      await generateFile(
        join(defaults.libDir, libBaseDir, `${table.fullName}.ts`),
        { template: baseTpl, context },
      );

      await generateFile(
        join(baseDir, schemaDir, tablesDir, `${table.name}.ts`),
        { template: tableTpl, context, format: true },
        { overwrite: false },
      );
    }

    for (const schema of schemas) {
      const entryMapper = (e: TableDeclaration | ViewDeclaration) => {
        return e.schema === schema ? [e] : [];
      };

      await generateFile(
        join(baseDir, schema === defaultSchema ? "" : schema, "tables.ts"),
        {
          template: indexTpl,
          context: {
            BANNER,
            tablesDir,
            tables: tables.flatMap(entryMapper),
            views: views.flatMap(entryMapper),
          },
        },
      );
    }
  };
};
