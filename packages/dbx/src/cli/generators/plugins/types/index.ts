import fsx from "fs-extra";

import { resolveCwd, renderToFile } from "@shared";
import { type GeneratorPlugin, type TypesTemplates, BANNER } from "@cli";

import knexDtsTpl from "./templates/knex.d.hbs";
import moduleDtsTpl from "./templates/module.d.hbs";
import indexTpl from "./templates/index.hbs";

const defaultTemplates: Required<TypesTemplates> = {
  knexDts: knexDtsTpl,
  moduleDts: moduleDtsTpl,
  index: indexTpl,
};

type TemplateName = keyof typeof defaultTemplates;

const typesPlugin: GeneratorPlugin = async (
  config,
  { schemas, tables, views, enums },
) => {
  const { base, typesTemplates } = config;

  const templates: typeof defaultTemplates = { ...defaultTemplates };

  for (const [name, file] of Object.entries({ ...typesTemplates })) {
    templates[name as TemplateName] = await fsx.readFile(
      resolveCwd(file),
      "utf8",
    );
  }

  for (const schema of schemas) {
    const schemaEnums = enums.filter((e) => e.schema === schema);
    const schemaTables = tables.filter((e) => e.schema === schema);
    const schemaViews = views.filter((e) => e.schema === schema);

    const context = {
      BANNER,
      base,
      enums: schemaEnums,
      tables: schemaTables,
      views: schemaViews,
    };

    for (const [outFile, tplName] of [
      ["knex.d.ts", "knexDts"],
      ["module.d.ts", "moduleDts"],
      ["index.ts", "index"],
    ] satisfies [outFile: string, tplName: TemplateName][]) {
      await renderToFile(
        resolveCwd(base, schema, "types", outFile),
        templates[tplName],
        context,
      );
    }
  }
};

export default typesPlugin;
