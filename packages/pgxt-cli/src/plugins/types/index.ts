import { join } from "node:path";

import { defaults } from "@appril/configs";
import { fileGenerator } from "@appril/dev-utils";

import { type GeneratorPlugin, BANNER } from "@/base";

import knexDtsTpl from "./templates/knex.d.hbs";
import indexTpl from "./templates/index.hbs";

export const typesDir = "types";

export default (): GeneratorPlugin => {
  return async function typesGenerator(data, { root, baseDir }) {
    const { schemas, tables, views, enums } = data;

    const { generateFile } = fileGenerator(root);

    for (const schema of schemas) {
      const schemaEnums = enums.filter((e) => e.schema === schema);
      const schemaTables = tables.filter((e) => e.schema === schema);
      const schemaViews = views.filter((e) => e.schema === schema);

      for (const [outfile, template] of [
        ["knex.d.ts", knexDtsTpl],
        ["index.ts", indexTpl],
      ]) {
        await generateFile(
          join(defaults.baseDir, baseDir, schema, typesDir, outfile),
          {
            template,
            context: {
              BANNER,
              enums: schemaEnums,
              tables: schemaTables,
              views: schemaViews,
            },
            format: true,
          },
        );
      }
    }
  };
};
