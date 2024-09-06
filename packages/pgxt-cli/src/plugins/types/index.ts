import { join } from "node:path";

import { fileGenerator } from "@appril/dev-utils";

import { type GeneratorPlugin, BANNER } from "@/base";

import knexDtsTpl from "./templates/knex.d.hbs";
import indexTpl from "./templates/index.hbs";

const defaultTemplates = {
  knexDts: knexDtsTpl,
  index: indexTpl,
};

export default (): GeneratorPlugin => {
  return async function typesGenerator(data, { root, baseDir }) {
    const { schemas, tables, views, enums } = data;

    const { generateFile } = fileGenerator(root);

    const templates: typeof defaultTemplates = { ...defaultTemplates };

    for (const schema of schemas) {
      const schemaEnums = enums.filter((e) => e.schema === schema);
      const schemaTables = tables.filter((e) => e.schema === schema);
      const schemaViews = views.filter((e) => e.schema === schema);

      for (const [outFile, tplName] of [
        ["knex.d.ts", "knexDts"],
        ["index.ts", "index"],
      ] satisfies [outFile: string, tplName: keyof typeof defaultTemplates][]) {
        await generateFile(join(baseDir, schema, "types", outFile), {
          template: templates[tplName],
          context: {
            BANNER,
            enums: schemaEnums,
            tables: schemaTables,
            views: schemaViews,
          },
          format: true,
        });
      }
    }
  };
};
