import nopt from "nopt";
import glob from "fast-glob";
import { sortBy } from "lodash-es";

import { resolvePath } from "../base";
import { BANNER, renderToFile } from "../render";

import defaultTemplate from "./templates/knexfile.hbs";

import type { MigrationsConfig } from "../@types";

type MigrationsSourceFile = {
  path: string;
  const: string;
};

type MigrationsSourceRenderContext = MigrationsConfig & {
  dbxfile: string;
  files: MigrationsSourceFile[];
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
    cwd: resolvePath(base, migrationDir),
    onlyFiles: true,
    absolute: false,
  });

  const files: MigrationsSourceFile[] = [];

  for (const path of matches) {
    files.push({
      path: path.replace(/\.ts$/, ""),
      const: ["$", path.replace(/\W/g, "_")].join(""),
    });
  }

  const template = migrationTemplates?.knexfile || defaultTemplate;

  await renderToFile<MigrationsSourceRenderContext>(
    resolvePath(outfile),
    BANNER + template,
    {
      ...config,
      dbxfile: dbxfile.replace(/\.ts$/, ""),
      files: sortBy(files, "path"),
    },
  );
}
