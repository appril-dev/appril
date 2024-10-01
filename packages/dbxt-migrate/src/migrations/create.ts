import { resolve, join } from "node:path";
import { format } from "node:util";

import prompts from "prompts";
import pg from "pg";
import { format as datetimeFormat } from "date-fns";
import { renderToFile } from "@appril/dev-utils";

import type { ResolvedConfig } from "@/types";

import createTableTpl from "./templates/createTable.hbs";
import alterTableTpl from "./templates/alterTable.hbs";
import dropTableTpl from "./templates/dropTable.hbs";
import genericTpl from "./templates/generic.hbs";

export default async (
  // absolute path
  root: string,
  config: ResolvedConfig,
): Promise<void> => {
  const { connection, baseDir, migrationDir, migrationDirSuffix } = config;

  const db = new pg.Client(connection);

  await db.connect();

  try {
    const query = `
      SELECT table_name as title
        FROM information_schema.tables
       WHERE table_schema not in ('pg_catalog', 'information_schema')
         AND table_type = 'BASE TABLE'
    `;

    const { rows: tables } = await db.query({
      text: query,
      values: [],
    });

    // biome-ignore lint:
    function onState(this: any) {
      if (this.aborted) {
        db.end();
        process.nextTick(() => process.exit(1));
      }
    }

    const input = await prompts([
      {
        type: "select",
        name: "template",
        message: "Migration Template",
        choices: [
          {
            title: "Create Table",
            value: { fileName: "create_table_%s", fileContent: createTableTpl },
          },
          {
            title: "Alter Table",
            value: { fileName: "alter_table_%s", fileContent: alterTableTpl },
          },
          {
            title: "Drop Table",
            value: { fileName: "drop_table_%s", fileContent: dropTableTpl },
          },
          {
            title: "Generic Migration",
            value: { fileName: "%s", fileContent: genericTpl, generic: true },
          },
        ] satisfies Array<{
          title: string;
          value: { fileName: string; fileContent: string; generic?: boolean };
        }>,
        onState,
      },

      {
        type: (_, { template }) => {
          return template.fileName.includes("create") ? "text" : "autocomplete";
        },
        name: "table",
        message: "Table Name",
        choices(_, { template }) {
          return template.generic ? [{ title: "[ None ]" }, ...tables] : tables;
        },
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
        initial(_, { template, table, details }) {
          return formatName(template.fileName, [
            table.replace("[ None ]", ""),
            details,
          ]);
        },
        validate(value) {
          return value?.trim().length ? true : "Please insert Migration Name";
        },
        onState,
      },
    ]);

    const name = [
      datetimeFormat(new Date(), "yyyyMMddHHmmss"),
      input.name,
    ].join("_");

    // relative to root
    const outfile = join(
      baseDir,
      migrationDir,
      migrationDirSuffix,
      `${name}.ts`,
    );

    const table = input.table.replace("[ None ]", "");

    await renderToFile(resolve(root, outfile), input.template.fileContent, {
      table,
    });

    console.log(`\x1b[32m➜\x1b[0m ${outfile} ✨`);
  } finally {
    db.end();
  }
};

function formatName(name: string, chunks: Array<string>) {
  return format(
    name,
    chunks
      .flatMap((e) => {
        const s = e?.trim?.();
        return s ? [s.replace(/\W/g, "_")] : [];
      })
      .join("_")
      .replace(/^_|_$/, ""),
  );
}
