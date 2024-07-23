import nopt from "nopt";
import fsx from "fs-extra";
import pgts from "@appril/pgts";

import { BANNER, resolvePath, run } from "../base";

import typesGenerator from "./types";

import type { GeneratorConfig, Templates } from "../@types";
import { renderToFile } from "@shared/render";

import baseTpl from "./templates/base.hbs";
import indexTpl from "./templates/index.hbs";
import tableTpl from "./templates/table.hbs";

const defaultTemplates: Required<Templates> = {
  base: baseTpl,
  index: indexTpl,
  table: tableTpl,
};

type TemplateName = keyof typeof defaultTemplates;

const { config: configFile } = nopt(
  {
    config: String,
  },
  {
    c: ["--config"],
  },
);

run(async () => {
  if (!(await fsx.pathExists(configFile))) {
    throw new Error(`Config file does not exists: ${configFile}`);
  }

  const { default: config }: { default: GeneratorConfig } = await import(
    resolvePath(configFile)
  );

  const { base } = config;

  for (const requiredParam of ["connection", "base"] as const) {
    if (!config[requiredParam]) {
      throw new Error(
        `Incomplete config provided, ${requiredParam} param missing`,
      );
    }
  }

  const { schemas, tables, views, enums } = await pgts(
    config.connection,
    config,
  );

  const templates: typeof defaultTemplates = { ...defaultTemplates };

  for (const [name, file] of Object.entries({ ...config.templates })) {
    templates[name as TemplateName] = await fsx.readFile(
      resolvePath(file),
      "utf8",
    );
  }

  process.stdout.write(" 🡺 Generating types... ");
  await typesGenerator(config, { schemas, tables, views, enums });
  console.log("Done ✨");

  process.stdout.write(" 🡺 Generating tables... ");

  for (const table of [...tables, ...views]) {
    const { schema, name } = table;
    const file = resolvePath(config.base, schema, "tables", `${name}.ts`);
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
      resolvePath(base, schema, "index.ts"),
      templates.index,
      context,
    );

    await renderToFile(
      resolvePath(base, schema, "base.ts"),
      templates.base,
      context,
    );
  }

  console.log("Done ✨");
});
