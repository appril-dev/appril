import { resolve, join } from "node:path";

import fsx from "fs-extra";
import { defaults } from "@appril/dev";
import { fileGenerator } from "@appril/dev-utils";

import {
  type Config,
  type GeneratorPluginData,
  type Templates,
  BANNER,
} from "../../base";

import baseTpl from "./templates/base.hbs";
import tableTpl from "./templates/table.hbs";
import indexTpl from "./templates/index.hbs";

const defaultTemplates: Required<Templates> = {
  base: baseTpl,
  table: tableTpl,
  index: indexTpl,
};

type TemplateName = keyof typeof defaultTemplates;

const tablesPlugin = async (
  // absolute path
  root: string,
  config: Config,
  { schemas, tables, views }: GeneratorPluginData,
) => {
  const { base } = config;

  const { generateFile } = fileGenerator(root);

  const templates: typeof defaultTemplates = { ...defaultTemplates };

  for (const [name, file] of Object.entries({ ...config.templates })) {
    templates[name as TemplateName] = await fsx.readFile(
      resolve(root, file),
      "utf8",
    );
  }

  for (const table of [
    ...tables.map((e) => ({ ...e, isTable: true })),
    ...views,
  ]) {
    const context = { table, defaults, base };

    await generateFile(join(defaults.varDir, base, `${table.fullName}.ts`), {
      template: templates.base,
      context,
    });

    await generateFile(
      join(base, table.schema, "tables", `${table.name}.ts`),
      { template: templates.table, context, format: true },
      { overwrite: false },
    );
  }

  for (const schema of schemas) {
    const schemaTables = tables.filter((e) => e.schema === schema);
    const schemaViews = views.filter((e) => e.schema === schema);

    await generateFile(join(base, schema, "index.ts"), {
      template: templates.index,
      context: {
        BANNER,
        base,
        tables: schemaTables,
        views: schemaViews,
        defaults,
      },
      format: true,
    });
  }
};

export default tablesPlugin;
