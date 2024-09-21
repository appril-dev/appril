import { defineConfig, typesPlugin, tablesPlugin } from "@appril/pgxt-cli";

import { connection, baseDir } from "~/config/db";

export default defineConfig({
  connection,
  baseDir,
  plugins: [typesPlugin(), tablesPlugin()],
});
