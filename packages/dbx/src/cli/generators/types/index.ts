import fsx from "fs-extra";

import type {
  GeneratorConfig,
  TypesTemplates,
  TableDeclaration,
  ViewDeclaration,
  EnumDeclaration,
} from "../../@types";

import { resolvePath } from "../../base";
import { BANNER, renderToFile } from "../../render";

import knexDtsTpl from "./templates/knex.d.hbs";
import moduleDtsTpl from "./templates/module.d.hbs";
import indexTpl from "./templates/index.hbs";

const defaultTemplates: Required<TypesTemplates> = {
  knexDts: knexDtsTpl,
  moduleDts: moduleDtsTpl,
  index: indexTpl,
};

type TemplateName = keyof typeof defaultTemplates;

export default async function typesGenerator(
  config: GeneratorConfig,
  {
    schemas,
    tables,
    views,
    enums,
  }: {
    schemas: string[];
    tables: TableDeclaration[];
    views: ViewDeclaration[];
    enums: EnumDeclaration[];
  },
): Promise<void> {
  const { base, typesTemplates } = config;

  const templates: typeof defaultTemplates = { ...defaultTemplates };

  for (const [name, file] of Object.entries({ ...typesTemplates })) {
    templates[name as TemplateName] = await fsx.readFile(
      resolvePath(file),
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
        resolvePath(base, schema, "types", outFile),
        templates[tplName],
        context,
      );
    }
  }
}
