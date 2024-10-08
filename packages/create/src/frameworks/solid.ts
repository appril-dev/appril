import { join } from "node:path";
import { format } from "node:util";

import { defaults } from "@appril/configs";
import { renderToFile } from "@appril/dev-utils";

import { mergeJsonFiles, copyFiles } from "@/base";

import viteConfigTpl from "./solid/src/vite.config.hbs";
import componentsLinkTpl from "./solid/src/components/Link.hbs";
import routerIndexTpl from "./solid/src/router/index.hbs";
import indexTpl from "./solid/src/index.hbs";

export default async (
  appRoot: string,
  {
    devPort,
    srcFolder,
  }: {
    devPort: number;
    srcFolder: string;
  },
): Promise<void> => {
  {
    const src = join(import.meta.dirname, "frameworks/solid/root");
    const dst = appRoot;

    await copyFiles(src, dst, {
      exclude: ["package.json", "tsconfig.json"],
    });

    await mergeJsonFiles(join(src, "package.json"), join(dst, "package.json"));

    await mergeJsonFiles(
      join(src, "tsconfig.json"),
      join(dst, "tsconfig.json"),
    );
  }

  {
    const src = join(import.meta.dirname, "frameworks/solid/src");
    const dst = join(appRoot, srcFolder);

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
        {
          devPort,
          defaults,
          srcFolder,
          importPathmap: {
            router: [
              srcFolder,
              format(defaults.libDirFormat, defaults.routerDir),
            ].join("/"),
          },
        },
        { format: true },
      );
    }
  }
};
