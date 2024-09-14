import { join } from "node:path";

import { defaults } from "@appril/configs";
import { fileGenerator } from "@appril/dev-utils";

import type { GeneratorPlugin } from "@/base";

import baseTpl from "./templates/base.hbs";
import tableTpl from "./templates/table.hbs";
import indexTpl from "./templates/index.hbs";

export const tablesDir = "tables";

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
        `${join(defaults.baseDir, baseDir, table.schema, tablesDir, table.name)}.ts`,
        { template: tableTpl, context, format: true },
        { overwrite: false },
      );
    }

    for (const schema of schemas) {
      const schemaTables = tables.filter((e) => e.schema === schema);
      const schemaViews = views.filter((e) => e.schema === schema);

      await generateFile(join(defaults.varDir, varDir, `${schema}.ts`), {
        template: indexTpl,
        context: {
          importBase: `${defaults.basePrefix}/${baseDir}`,
          tablesDir,
          tables: schemaTables,
          views: schemaViews,
        },
      });

      await generateFile(
        join(defaults.baseDir, baseDir, schema, "index.ts"),
        `export * from "${defaults.basePrefix}/${varDir}/${schema}";`,
        { overwrite: false },
      );
    }
  };
};
