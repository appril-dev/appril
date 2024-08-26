import { resolve, dirname, join } from "node:path";

import fsx from "fs-extra";
import nopt from "nopt";
import glob from "fast-glob";
import { build } from "esbuild";
import { sortBy } from "lodash-es";

import { defaults } from "@appril/dev";
import { renderToFile } from "@appril/dev-utils";

import { type Config, BANNER, getEsbuildConfig } from "../base";

import defaultTemplate from "./templates/knexfile.hbs";

type MigrationsSourceFile = {
  path: string;
  const: string;
};

type MigrationsSourceRenderContext = Config & {
  defaults: Record<string, unknown>;
  dbxfile: string;
  files: Array<MigrationsSourceFile>;
};

const { outdir } = nopt({
  outdir: String,
});

export default async function generateKnexfile(
  configFile: string,
  config: Config,
): Promise<void> {
  const root = dirname(configFile);
  const { base, migrationDir, migrationTemplates } = config;

  const matches = await glob("**/*.ts", {
    cwd: resolve(root, join(base, migrationDir)),
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

  const knexfile = resolve(root, `knexfile.${new Date().getTime()}.ts`);

  const esbuildConfig = await getEsbuildConfig(root);

  await renderToFile<MigrationsSourceRenderContext>(
    knexfile,
    BANNER + template,
    {
      ...config,
      defaults,
      dbxfile: configFile.replace(/\.ts$/, ""),
      files: sortBy(files, "path"),
    },
  );

  try {
    await build({
      ...esbuildConfig,
      bundle: true,
      entryPoints: [knexfile],
      outfile: resolve(root, join(outdir, "knexfile.mjs")),
    });
  } finally {
    await fsx.unlink(knexfile);
  }
}
