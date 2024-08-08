import { resolve } from "node:path";

import fsx from "fs-extra";

import type { ResolvedConfig } from "vite";

import type {
  ResolvedPluginOptions,
  SolidPage,
  BootstrapPayload,
  WatchHandler,
} from "../@types";

import { sourceFilesParsers } from "./parsers";

/** *_routes.toml schema - page options:

# set page to false to exclude route from client's route stack
[some-route]
page = false

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

# with params

["users/[id]"]
# will generate {pagesDir}/users/[id].tsx

["users/[id]/"]
# will generate {pagesDir}/users/[id]/index.tsx

["users/[id]/account"]
# will generate {pagesDir}/users/[id]/account.tsx

# with optional params

["users/[[id]]"]
# will generate {pagesDir}/users/[[id]].tsx

# with rest params

["pages/[...path]"]
# will generate {pagesDir}/pages/[...path].tsx

## data loader

["orders"]
dataLoader = true
# will automatically create api endpoint, generate loader and provide it to route

# custom dataLoader

["orders"]
dataLoader = "@/pages/orders.data"
# will provide given path to route.
# file should export loader as default function.
# loader will receive params as first argument.

# aliased dataLoader

["admins/[id]"]
dataLoader = { alias = "admins" }
# will use admins default dataLoader rather than generate own.
# unexpected errors if admin has no dataLoader or has custom dataLoader.

## provide meta
["some-page"]
meta = { restricted = true, privileges = { role = "manager" } }

*/

type Workers = typeof import("./workers");

export async function solidPages(
  config: ResolvedConfig,
  options: ResolvedPluginOptions,
  { workerPool }: { workerPool: Workers },
) {
  const { root, sourceFolder } = options;

  const pageMap: Record<string, SolidPage> = {};

  const srcWatchers: Record<string, () => Promise<void>> = {};

  // intentionally not watching template, keep things simple.
  // when custom template updated, dev server should be restarted manually
  // for new pages to use custom template.
  const template = options.solidPages?.template
    ? await fsx.readFile(resolve(root, options.solidPages.template), "utf8")
    : undefined;

  const watchHandler: WatchHandler = (watcher) => {
    for (const pattern of [...Object.keys(srcWatchers)]) {
      watcher.add(pattern);
    }

    watcher.on("change", async (file) => {
      if (srcWatchers[file]) {
        // updating pageMap
        await srcWatchers[file]();

        // then feeding it to worker
        await workerPool.handleSrcFileUpdate({
          file,
          pages: Object.values(pageMap),
          template,
        });

        return;
      }
    });
  };

  for (const { file, parser } of await sourceFilesParsers(config, options)) {
    srcWatchers[file] = async () => {
      for (const { page } of await parser()) {
        pageMap[page.path] = page;
      }
    };
  }

  // populating srcWatchers for bootstrap
  for (const handler of Object.values(srcWatchers)) {
    await handler();
  }

  const bootstrapPayload: BootstrapPayload<Workers> = {
    root,
    sourceFolder,
    pages: Object.values(pageMap),
    template,
  };

  return {
    bootstrapPayload,
    watchHandler,
  };
}
