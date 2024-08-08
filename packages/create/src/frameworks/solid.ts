import { join } from "node:path";

import { renderToFile } from "@appril/dev-utils";

import { mergePackageJson, copyFiles } from "../base";

import viteConfigTpl from "./solid/src/vite.config.hbs";

export default async (
  root: string,
  {
    devPort,
    sourceFolder,
  }: {
    sourceFolder: string;
    devPort: number;
  },
): Promise<void> => {
  {
    const src = join(import.meta.dirname, "frameworks/solid/root");
    const dst = root;

    await copyFiles(src, dst, {
      exclude: ["package.json"],
    });

    await mergePackageJson(src, dst);
  }

  {
    const src = join(import.meta.dirname, "frameworks/solid/src");
    const dst = join(root, sourceFolder);

    await copyFiles(src, dst, {
      exclude: [/.+\.hbs/],
    });

    await renderToFile(
      join(dst, "vite.config.ts"),
      viteConfigTpl,
      { devPort },
      { format: true },
    );
  }
};
