import { join } from "node:path";

import prompts from "prompts";
import pg from "pg";
import { format as datetimeFormat } from "date-fns";
import { resolveCwd, renderToFile } from "@appril/utils";

import type { MigrationsConfig, MigrationsTemplates } from "../base";

import createTableTpl from "./templates/createTable.hbs";
import alterTableTpl from "./templates/alterTable.hbs";
import dropTableTpl from "./templates/dropTable.hbs";
import genericTpl from "./templates/generic.hbs";

type Templates = Required<Omit<MigrationsTemplates, "knexfile">>;

const defaultTemplates: Templates = {
  createTable: createTableTpl,
  alterTable: alterTableTpl,
  dropTable: dropTableTpl,
  generic: genericTpl,
};

export default async function createMigration(
  config: MigrationsConfig,
): Promise<void> {
  const {
    connection,
    schemas,
    base,
    migrationDir,
    migrationSubdir,
    migrationTemplates,
  } = config;

  const db = new pg.Client(connection);

  await db.connect();

  try {
    const query = `
      SELECT table_name as title
        FROM information_schema.tables
       WHERE table_schema = ANY($1::text[])
         AND table_type = 'BASE TABLE'
    `;

    const { rows: tables } = await db.query({
      text: query,
      values: [schemas],
    });

    // biome-ignore lint:
    function onState(this: any) {
      if (this.aborted) {
        db.end();
        process.nextTick(() => process.exit(0));
      }
    }

    const input = await prompts([
      {
        type: "select",
        name: "template",
        message: "Migration Template",
        choices: [
          { title: "Create Table", value: "createTable" },
          { title: "Alter Table", value: "alterTable" },
          { title: "Drop Table", value: "dropTable" },
          { title: "Generic Migration", value: "generic" },
        ],
        onState,
      },

      {
        type: (prev) => (prev === "createTable" ? "text" : "autocomplete"),
        name: "table",
        message: "Table Name",
        choices(prev) {
          return prev === "generic"
            ? [{ title: "[ None ]", value: "@none" }, ...tables]
            : tables;
        },
        initial: (prev) => (prev === "createTable" ? "" : "@none"),
        // biome-ignore lint:
        onState(this: any) {
          onState.apply(this);
          this.fallback = { title: this.input, value: this.input };
          if (this.suggestions?.length === 0) {
            this.value = this.fallback.value;
          }
        },
      },

      {
        type: "text",
        name: "details",
        message: "Migration Details",
        initial: "",
        onState,
      },

      {
        type: "text",
        name: "name",
        message: "Migration Name",
        initial(details, { template, table }) {
          return template === "generic"
            ? formatName(details || table.replace("@none", "") || template)
            : formatName(template.replace("Table", ""), table, details);
        },
        validate(value) {
          return value?.trim().length ? true : "Please insert Migration Name";
        },
        onState,
      },
    ]);

    const templates = { ...defaultTemplates, ...migrationTemplates };

    const template = templates[input.template as keyof Templates];

    if (!template) {
      throw new Error(
        `Unknown/Empty Template: ${JSON.stringify(input.template)}`,
      );
    }

    const name = formatName(
      datetimeFormat(new Date(), "yyyyMMddHHmmss"),
      input.name,
    );

    const outfile = join(
      base,
      migrationDir,
      migrationSubdir || "",
      `${name}.ts`,
    );

    const table = input.table.replace("@none", "");

    await renderToFile(resolveCwd(outfile), template, { table });

    console.log(`\x1b[32m√\x1b[0m ${outfile} ✨`);
  } finally {
    db.end();
  }
}

function formatName(...chunks: string[]) {
  return chunks
    .filter((e) => e?.trim?.())
    .map((e) => e.trim().replace(/\W+/g, "_"))
    .join("_")
    .replace(/^_|_$/, "");
}
