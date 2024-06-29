import { resolve } from "node:path";

import fsx from "fs-extra";

import type { ResolvedConfig } from "vite";

import type {
  ResolvedPluginOptions,
  SolidPage,
  SolidTemplates,
  BootstrapPayload,
} from "../@types";

import { sourceFilesParsers } from "./parsers";

/** {routerDir}/_pages.toml schema:

["some-page"]
# will generate {pagesDir}/some-page.tsx

["another-page/"]
# will generate {pagesDir}/another-page/index.tsx

["another-page/base"]
# will generate {pagesDir}/another-page/base.tsx

["some-page.html"]
# will generate {pagesDir}/some-page.html.tsx

["users/"]
# will generate {pagesDir}/users.tsx

["users/:id"]
# will generate {pagesDir}/users/:id.tsx

["users/:id/"]
# will generate {pagesDir}/users/:id/index.tsx

["users/:id+o"]
# will generate {pagesDir}/users/:id+o.tsx

["users/:id/account"]
# will generate {pagesDir}/users/:id/account.tsx

["pages/:path+a"]
# will generate {pagesDir}/pages/:path+a.tsx

## data loader

["orders"]
dataLoader = true
# will automatically create api endpoint, create loader and provide it to route

["orders"]
dataLoader = "@/pages/orders.data"
# will provide given path to route.
# file should export loader as default function.
# loader will receive params as first argument.

## provide meta
["some-page"]
meta = { restricted = true, privileges = { role = "manager" } }

*/

/**
 * Generates various files based on {pagesDir}/_pages.toml
 *
 * Generated files:
 *    - {pagesDir}/{page}.tsx (or {pagesDir}/{page}/index.tsx if path ends in a slash)
 *    - {routerDir}/routes.ts
 *    - {routerDir}/index.ts
 */

type Workers = typeof import("./workers");

export async function solidPages(
  config: ResolvedConfig,
  options: ResolvedPluginOptions,
  { workerPool }: { workerPool: Workers },
) {
  const { sourceFolder, sourceFolderPath } = options;

  const pageMap: Record<string, SolidPage> = {};

  const tplWatchers: Record<string, () => Promise<void>> = {};
  const srcWatchers: Record<string, () => Promise<void>> = {};

  const customTemplates: SolidTemplates = {};

  const watchHandler = async (file: string) => {
    if (tplWatchers[file]) {
      // updating templates; to be used on newly added pages only
      // so no need to update anything here
      await tplWatchers[file]();
      return;
    }

    if (srcWatchers[file]) {
      // updating pageMap
      await srcWatchers[file]();

      // then feeding it to worker
      await workerPool.handleSrcFileUpdate({
        file,
        pages: Object.values(pageMap),
        customTemplates,
      });

      return;
    }
  };

  for (const [name, path] of Object.entries(
    options.solidPages?.templates || {},
  ) as [name: keyof SolidTemplates, file: string][]) {
    const file = resolve(sourceFolderPath, path);
    tplWatchers[file] = async () => {
      customTemplates[name] = await fsx.readFile(file, "utf8");
    };
  }

  for (const { file, parser } of await sourceFilesParsers(config, options)) {
    srcWatchers[file] = async () => {
      for (const { page } of await parser()) {
        pageMap[page.path] = page;
      }
    };
  }

  // populating tplWatchers for bootstrap
  for (const handler of Object.values(tplWatchers)) {
    await handler();
  }

  // populating srcWatchers for bootstrap (only call alfter tplWatchers populated)
  for (const handler of Object.values(srcWatchers)) {
    await handler();
  }

  const bootstrapPayload: BootstrapPayload<Workers> = {
    pages: Object.values(pageMap),
    sourceFolder,
    sourceFolderPath,
    customTemplates,
  };

  return {
    bootstrapPayload,
    watchHandler,
    watchPatterns: [...Object.keys(tplWatchers), ...Object.keys(srcWatchers)],
  };
}
