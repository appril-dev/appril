import { resolve } from "node:path";

import fsx from "fs-extra";

import type { ResolvedConfig } from "vite";

import type {
  PluginOptionsResolved,
  ApiRoute,
  BootstrapPayload,
  WatchHandler,
} from "@/base";

import { sourceFilesParsers } from "./parsers";

/** *_routes.toml schema - api options:

# set api to false to exclude route
[some-route]
api = false

[some-route]
# will generate {apiDir}/some-route.ts

["account/activate/"]
# will generate {apiDir}/account/activate/index.ts

["account/activate/verify"]
# will generate {apiDir}/account/activate/verify.ts

["some-page.html"]
# will generate {apiDir}/some-page.html.ts

["another-page.html/"]
# will generate {apiDir}/another-page.html/index.ts

## dynamic params - wrapped into [square brackets]

["users/[id]"]
# will generate {apiDir}/users/[id].ts

["users/[id].json"]
# will generate {apiDir}/users/[id].json.ts

## optional params - wrapped into [[double square brackets]]

["users/[[id]]"]
# will generate {apiDir}/users/[[id]].ts

## any/rest params - ...rest wrapped into [...square brackets]

["cms/[...path]"]
# will generate {apiDir}/cms/[...path].ts

["cms/[...path].html"]
# will generate {apiDir}/cms/[...path].html.ts

*/

type Workers = typeof import("./workers");

export async function apiGenerator(
  config: ResolvedConfig,
  options: PluginOptionsResolved,
  { workerPool }: { workerPool: Workers },
) {
  const { appRoot, sourceFolder } = options;

  const routeMap: Record<string, ApiRoute> = {};

  const srcWatchers: Record<string, () => Promise<void>> = {};

  // intentionally not watching template, keep things simple.
  // when custom template updated, dev server should be restarted manually
  // for new routes to use custom template.
  const template = options.apiGenerator?.template
    ? await fsx.readFile(
        resolve(config.root, options.apiGenerator.template),
        "utf8",
      )
    : undefined;

  const watchHandler: WatchHandler = (watcher) => {
    for (const pattern of [...Object.keys(srcWatchers)]) {
      watcher.add(pattern);
    }

    watcher.on("change", async (file) => {
      if (srcWatchers[file]) {
        // updating routeMap / aliasMap
        await srcWatchers[file]();

        // then feeding them to worker
        await workerPool.handleSrcFileUpdate({
          file,
          routes: Object.values(routeMap),
          template,
        });

        return;
      }
    });
  };

  for (const { file, parser } of await sourceFilesParsers(config, options)) {
    srcWatchers[file] = async () => {
      for (const { route } of await parser()) {
        // using fileFullpath to match file provided by watcher
        routeMap[route.fileFullpath] = route;
      }
    };
  }

  // populating srcWatchers for bootstrap
  for (const handler of Object.values(srcWatchers)) {
    await handler();
  }

  const bootstrapPayload: BootstrapPayload<Workers> = {
    appRoot,
    sourceFolder,
    routes: Object.values(routeMap),
    template,
  };

  return {
    bootstrapPayload,
    watchHandler,
  };
}
