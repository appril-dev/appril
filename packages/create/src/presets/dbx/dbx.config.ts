import { defineConfig } from "@appril/dbx-cli";

import { connection, client } from "./config/knex";

export default defineConfig({
  connection,
  client,
  base: "dbx",
  migrationDir: "migrations", // relative to base
});
