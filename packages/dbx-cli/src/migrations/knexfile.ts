import { resolve, join } from "node:path";

import fsx from "fs-extra";
import glob from "fast-glob";
import { sortBy } from "lodash-es";
import { type BuildOptions, build as esbuild } from "esbuild";

import { defaults } from "@appril/dev";
import { renderToFile } from "@appril/dev-utils";

import { type Config, BANNER } from "../base";

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

export default async (
  // absolute path
  root: string,
  config: Config,
  esbuildConfig: BuildOptions,
  {
    dbxfile,
    outfile,
  }: {
    // relative to root
    dbxfile: string;
    // relative to root
    outfile: string;
  },
): Promise<void> => {
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

  await renderToFile<MigrationsSourceRenderContext>(
    knexfile,
    BANNER + template,
    {
      ...config,
      defaults,
      dbxfile: dbxfile.replace(/\.ts$/i, ""),
      files: sortBy(files, "path"),
    },
  );

  try {
    await esbuild({
      ...esbuildConfig,
      bundle: true,
      entryPoints: [knexfile],
      outfile: resolve(root, outfile),
      logLevel: "error",
    });
  } finally {
    await fsx.unlink(knexfile);
  }
};
