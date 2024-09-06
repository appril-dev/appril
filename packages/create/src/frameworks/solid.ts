import { join } from "node:path";

import { defaults } from "@appril/dev";
import { renderToFile } from "@appril/dev-utils";

import { mergePackageJson, copyFiles } from "@/base";

import viteConfigTpl from "./solid/src/vite.config.hbs";
import componentsLinkTpl from "./solid/src/components/Link.hbs";
import routerIndexTpl from "./solid/src/router/index.hbs";
import indexTpl from "./solid/src/index.hbs";

export default async (
  appRoot: string,
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
    const dst = appRoot;

    await copyFiles(src, dst, {
      exclude: ["package.json"],
    });

    await mergePackageJson(src, dst);
  }

  {
    const src = join(import.meta.dirname, "frameworks/solid/src");
    const dst = join(appRoot, sourceFolder);

    await copyFiles(src, dst, {
      exclude: [/.+\.hbs/],
    });

    for (const [file, template] of [
      ["index.ts", indexTpl],
      ["vite.config.ts", viteConfigTpl],
      ["router/index.tsx", routerIndexTpl],
      ["components/Link.tsx", componentsLinkTpl],
    ]) {
      await renderToFile(
        join(dst, file),
        template,
        { devPort, defaults, sourceFolder },
        { format: true },
      );
    }
  }
};
