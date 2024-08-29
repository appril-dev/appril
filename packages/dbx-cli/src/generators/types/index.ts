import { resolve, join } from "node:path";

import fsx from "fs-extra";
import { fileGenerator } from "@appril/dev-utils";

import {
  type Config,
  type GeneratorPluginData,
  type TypesTemplates,
  BANNER,
} from "../../base";

import knexDtsTpl from "./templates/knex.d.hbs";
import indexTpl from "./templates/index.hbs";

const defaultTemplates: Required<TypesTemplates> = {
  knexDts: knexDtsTpl,
  index: indexTpl,
};

type TemplateName = keyof typeof defaultTemplates;

const typesPlugin = async (
  // absolute path
  root: string,
  config: Config,
  { schemas, tables, views, enums }: GeneratorPluginData,
) => {
  const { base, typesTemplates } = config;

  const { generateFile } = fileGenerator(root);

  const templates: typeof defaultTemplates = { ...defaultTemplates };

  for (const [name, file] of Object.entries({ ...typesTemplates })) {
    templates[name as TemplateName] = await fsx.readFile(
      resolve(root, file),
      "utf8",
    );
  }

  for (const schema of schemas) {
    const schemaEnums = enums.filter((e) => e.schema === schema);
    const schemaTables = tables.filter((e) => e.schema === schema);
    const schemaViews = views.filter((e) => e.schema === schema);

    for (const [outFile, tplName] of [
      ["knex.d.ts", "knexDts"],
      ["index.ts", "index"],
    ] satisfies [outFile: string, tplName: TemplateName][]) {
      await generateFile(join(base, schema, "types", outFile), {
        template: templates[tplName],
        context: {
          BANNER,
          base,
          enums: schemaEnums,
          tables: schemaTables,
          views: schemaViews,
        },
        format: true,
      });
    }
  }
};

export default typesPlugin;
