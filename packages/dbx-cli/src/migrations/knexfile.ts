import nopt from "nopt";
import glob from "fast-glob";
import { sortBy } from "lodash-es";
import { resolveCwd, renderToFile } from "@appril/dev-utils";

import { type MigrationsConfig, BANNER } from "../base";

import defaultTemplate from "./templates/knexfile.hbs";

type MigrationsSourceFile = {
  path: string;
  const: string;
};

type MigrationsSourceRenderContext = MigrationsConfig & {
  dbxfile: string;
  files: Array<MigrationsSourceFile>;
};

const { dbxfile, outfile } = nopt({
  dbxfile: String,
  outfile: String,
});

export default async function generateKnexfile(
  config: MigrationsConfig,
): Promise<void> {
  if (!dbxfile) {
    throw new Error("No dbxfile provided");
  }

  if (!outfile) {
    throw new Error("No outfile provided");
  }

  const { base, migrationDir, migrationTemplates } = config;

  const matches = await glob("**/*.ts", {
    cwd: resolveCwd(base, migrationDir),
    onlyFiles: true,
    absolute: false,
  });

  const files: Array<MigrationsSourceFile> = [];

  for (const path of matches) {
    files.push({
      path: path.replace(/\.ts$/, ""),
      const: ["$", path.replace(/\W/g, "_")].join(""),
    });
  }

  const template = migrationTemplates?.knexfile || defaultTemplate;

  await renderToFile<MigrationsSourceRenderContext>(
    resolveCwd(outfile),
    BANNER + template,
    {
      ...config,
      dbxfile: dbxfile.replace(/\.ts$/, ""),
      files: sortBy(files, "path"),
    },
  );
}
