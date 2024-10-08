import { resolve, join } from "node:path";

import fsx from "fs-extra";
import glob from "fast-glob";
import { type BuildOptions, build as esbuild } from "esbuild";

import { defaults } from "@appril/configs";
import { renderToFile } from "@appril/dev-utils";

import type { ResolvedConfig } from "@/types";

import template from "./templates/knexfile.hbs";

export const BANNER = `/**
* @generated by @appril/dbxt-migrate; do not modify manually!
*/`;

type MigrationsSourceFile = {
  path: string;
  const: string;
};

type MigrationsSourceRenderContext = ResolvedConfig & {
  importPathmap: {
    configDir: string;
    migrationDir: string;
  };
  files: Array<MigrationsSourceFile>;
};

export default async (
  // absolute path
  root: string,
  {
    config,
    esbuildConfig,
    // relative to root
    outdir,
    transient,
  }: {
    config: ResolvedConfig;
    esbuildConfig: BuildOptions;
    outdir?: string;
    transient?: boolean;
  },
): Promise<string> => {
  const { baseDir, migrationDir } = config;

  const matches = await glob("**/*.ts", {
    cwd: resolve(root, baseDir, migrationDir),
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

  const knexfile = resolve(root, `knexfile.${new Date().getTime()}.ts`);

  await renderToFile<MigrationsSourceRenderContext>(
    knexfile,
    BANNER + template,
    {
      ...config,
      importPathmap: {
        configDir: [defaults.appPrefix, defaults.configDir].join("/"),
        migrationDir: [defaults.appPrefix, baseDir, migrationDir].join("/"),
      },
      files: files.sort((a, b) => a.path.localeCompare(b.path)),
    },
  );

  const outfile = resolve(
    root,
    join(
      outdir || ".",
      transient ? `knexfile.${new Date().getTime()}.mjs` : "knexfile.mjs",
    ),
  );

  try {
    await esbuild({
      ...esbuildConfig,
      bundle: true,
      entryPoints: [knexfile],
      outfile,
      logLevel: "error",
    });
  } finally {
    await fsx.unlink(knexfile);
  }

  return outfile;
};
