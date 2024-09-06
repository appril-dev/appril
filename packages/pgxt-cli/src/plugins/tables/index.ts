import { join } from "node:path";

import { defaults } from "@appril/dev";
import { fileGenerator } from "@appril/dev-utils";
import type { TableDeclaration, ViewDeclaration } from "@appril/pgxt";

import {
  type GeneratorPlugin,
  type GeneratorPluginConfig,
  BANNER,
} from "@/base";

import baseTpl from "./templates/base.hbs";
import tableTpl from "./templates/table.hbs";
import indexTpl from "./templates/index.hbs";

const tablesDir = "tables";

export default (): GeneratorPlugin => {
  return async function tablesGenerator(data, { root, baseDir }) {
    const { schemas, tables, views } = data;
    const varDir = `{${baseDir}}`;

    const { generateFile } = fileGenerator(root);

    for (const table of [
      ...tables.map((e) => ({ ...e, isTable: true })),
      ...views,
    ]) {
      const context = { table, defaults, baseDir, varDir };

      await generateFile(
        join(defaults.varDir, varDir, `${table.fullName}.ts`),
        {
          template: baseTpl,
          context,
        },
      );

      await generateFile(
        `${tablePublicPath(table, { root, baseDir })}.ts`,
        { template: tableTpl, context, format: true },
        { overwrite: false },
      );
    }

    for (const schema of schemas) {
      const schemaTables = tables.filter((e) => e.schema === schema);
      const schemaViews = views.filter((e) => e.schema === schema);

      await generateFile(join(baseDir, schema, "index.ts"), {
        template: indexTpl,
        context: {
          BANNER,
          tablesDir,
          tables: schemaTables,
          views: schemaViews,
        },
        format: true,
      });
    }
  };
};

export function tablePublicPath(
  table: TableDeclaration | ViewDeclaration,
  { baseDir }: GeneratorPluginConfig,
) {
  return join(baseDir, table.schema, tablesDir, table.name);
}
