import { join } from "node:path";

import fsx from "fs-extra";
import { resolveCwd, fileGenerator } from "@appril/dev-utils";

import {
  type GeneratorPlugin,
  type TypesTemplates,
  BANNER,
} from "../../../base";

import knexDtsTpl from "./templates/knex.d.hbs";
import indexTpl from "./templates/index.hbs";

const defaultTemplates: Required<TypesTemplates> = {
  knexDts: knexDtsTpl,
  index: indexTpl,
};

type TemplateName = keyof typeof defaultTemplates;

const typesPlugin: GeneratorPlugin = async (
  config,
  { schemas, tables, views, enums },
) => {
  const { base, typesTemplates } = config;

  const { generateFile } = fileGenerator(resolveCwd());

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
