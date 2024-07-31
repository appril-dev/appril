import fsx from "fs-extra";
import { resolveCwd, renderToFile } from "@appril/utils";

import { type GeneratorPlugin, type Templates, BANNER } from "../../../base";

import baseTpl from "./templates/base.hbs";
import indexTpl from "./templates/index.hbs";
import tableTpl from "./templates/table.hbs";

const defaultTemplates: Required<Templates> = {
  base: baseTpl,
  index: indexTpl,
  table: tableTpl,
};

type TemplateName = keyof typeof defaultTemplates;

const tablesPlugin: GeneratorPlugin = async (
  config,
  { schemas, tables, views },
) => {
  const { base } = config;

  const templates: typeof defaultTemplates = { ...defaultTemplates };

  for (const [name, file] of Object.entries({ ...config.templates })) {
    templates[name as TemplateName] = await fsx.readFile(
      resolveCwd(file),
      "utf8",
    );
  }

  for (const table of [...tables, ...views]) {
    const { schema, name } = table;
    const file = resolveCwd(config.base, schema, "tables", `${name}.ts`);
    await renderToFile(file, templates.table, table, { overwrite: false });
  }

  for (const schema of schemas) {
    const schemaTables = tables.filter((e) => e.schema === schema);
    const schemaViews = views.filter((e) => e.schema === schema);

    const context = {
      BANNER,
      base,
      tables: schemaTables,
      views: schemaViews,
    };

    await renderToFile(
      resolveCwd(base, schema, "index.ts"),
      templates.index,
      context,
    );

    await renderToFile(
      resolveCwd(base, schema, "base.ts"),
      templates.base,
      context,
    );
  }
};

export default tablesPlugin;
