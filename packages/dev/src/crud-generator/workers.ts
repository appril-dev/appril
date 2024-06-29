import { dirname, join } from "node:path";

import { stringify } from "smol-toml";
import type { ApiTypesLiteral, DefaultTemplates } from "@appril/crud";

import type { ApiRouteConfig } from "../@types";
import type { CustomTemplates, Table } from "./@types";

import { fileGenerator } from "../base";
import { BANNER, render } from "../render";
import { defaults } from "../defaults";
import { extractTypes } from "./ast";

const { generateFile } = fileGenerator();

let defaultTemplates: DefaultTemplates;

// all these values are static so it's safe to store them at initialization;
// tables and customTemplates instead are constantly updated
// so should be provided to workers on every call
let sourceFolder: string;
let sourceFolderPath: string;
let base: string;
let dbxBase: string;

export async function bootstrap(data: {
  sourceFolder: string;
  sourceFolderPath: string;
  base: string;
  dbxBase: string;
  tables: Table[];
  customTemplates: CustomTemplates;
}) {
  const { tables, customTemplates } = data;

  sourceFolder = data.sourceFolder;
  sourceFolderPath = data.sourceFolderPath;
  base = data.base;
  dbxBase = data.dbxBase;

  const { readTemplates } = await import("@appril/crud/templates");

  // should always go first
  defaultTemplates = await readTemplates();

  await generateFile(join(defaults.varDir, "env.d.ts"), "");

  for (const table of tables) {
    await generateVarFiles({ table, customTemplates });
  }

  await generateApiFiles({ tables, customTemplates });
}

export async function handleSchemaFileUpdate({
  tables,
  schema,
  customTemplates,
}: {
  tables: Table[];
  schema: string;
  customTemplates: CustomTemplates;
}) {
  // ensuring modules generated for newly added tables
  for (const table of tables.filter((e) => e.schema === schema)) {
    await generateVarFiles({ table, customTemplates });
  }

  // ensuring newly added tables reflected in api index files
  await generateApiFiles({ tables, customTemplates });
}

export async function handleApiFileUpdate({
  table,
  customTemplates,
}: {
  table: Table;
  customTemplates: CustomTemplates;
}) {
  // rebuilding client modules for table represented by updated api file
  await generateVarFiles({ table, customTemplates });

  // only client modules updated here, api index files not affected
}

export async function handleCustomTemplateUpdate({
  tables,
  customTemplates,
}: {
  tables: Table[];
  customTemplates: CustomTemplates;
}) {
  // rebuilding client modules for all tables when some custom template updated
  for (const table of tables) {
    await generateVarFiles({ table, customTemplates });
  }

  // customTemplates only relevant to client modules, api index files not affected
}

async function generateApiFiles(data: {
  tables: Table[];
  customTemplates: CustomTemplates;
}) {
  const tables = data.tables.sort((a, b) => a.name.localeCompare(b.name));
  const templates = { ...defaultTemplates.api, ...data.customTemplates?.api };

  const routes: Record<string, ApiRouteConfig> = {};

  for (const table of tables) {
    routes[table.apiPath] = {
      file: table.apiFile,
      template: templates["route.ts"].file,
      templateContext: { base, basename: table.basename },
      meta: table.meta,
    };
  }

  // not creating route file directly,
  // rather adding routes to a source file
  // and file will be created by api generator plugin
  await generateFile(
    join(defaults.apiDir, base, defaults.apiSourceFile),
    [BANNER.trim().replace(/^/gm, "#"), stringify(routes)].join("\n"),
  );
}

async function generateVarFiles({
  table,
  customTemplates,
}: {
  table: Table;
  customTemplates: CustomTemplates;
}) {
  await generateFile(join(defaults.varDir, base, "env.d.ts"), "");

  await generateFile(join(defaults.varDir, base, table.basename, "api.ts"), {
    template: defaultTemplates.api["base.ts"].content,
    context: { ...table, dbxBase, sourceFolder },
  });

  const apiTypes = await extractTypes(table.apiFileFullpath, {
    relpathResolver(path) {
      return join(sourceFolder, defaults.apiDir, dirname(table.apiFile), path);
    },
  });

  const templates = { ...defaultTemplates.client, ...customTemplates.client };

  for (const [file, tpl] of Object.entries(templates)) {
    // biome-ignore format:
    let content = [
      [/@crud:base-placeholder\b/, base],
    ].reduce(
      (prev, [regex, text]) => prev.replace(regex, text as string),
      tpl.content,
    );

    const context: Record<string, unknown> = {
      ...table,
      dbxBase,
      apiTypes,
      sourceFolder,
    };

    if (["assets.ts", "apiTypes.ts"].includes(file)) {
      const apiTypesLiteral: ApiTypesLiteral = {
        EnvT: false,
        ListAssetsT: false,
        ItemAssetsT: false,
      };

      for (const key of Object.keys(
        apiTypesLiteral,
      ) as (keyof ApiTypesLiteral)[]) {
        apiTypesLiteral[key] = key in apiTypes;
      }

      context.apiTypesLiteral = JSON.stringify(apiTypesLiteral);

      content = render(content, context);
    }

    await generateFile(
      join(defaults.varDir, base, table.basename, file),
      content,
    );
  }
}
