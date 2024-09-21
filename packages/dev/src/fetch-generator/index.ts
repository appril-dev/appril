import { resolve } from "node:path";

import type { ResolvedConfig } from "vite";

import {
  type PluginOptionsResolved,
  type ApiRoute,
  type BootstrapPayload,
  type WatchHandler,
  defaults,
} from "@/base";

import { sourceFilesParsers } from "@/api-generator/parsers";

type Workers = typeof import("./workers");

export async function fetchGenerator(
  config: ResolvedConfig,
  options: PluginOptionsResolved,
  { workerPool }: { workerPool: Workers },
) {
  const { appRoot, sourceFolder } = options;

  const { filter = (_r: ApiRoute) => true } = options.fetchGenerator;

  const srcWatchers: Record<string, () => Promise<void>> = {};

  const routeMap: Record<string, ApiRoute> = {};

  const watchHandler: WatchHandler = (watcher) => {
    for (const pattern of [
      // watching source files for changes
      ...Object.keys(srcWatchers),
      // also watching files in apiDir for changes
      `${resolve(config.root, defaults.apiDir)}/**/*.ts`,
    ]) {
      watcher.add(pattern);
    }

    watcher.on("change", async (file) => {
      if (srcWatchers[file]) {
        // updating routeMap
        await srcWatchers[file]();

        // then feeding routeMap to worker
        await workerPool.handleSrcFileUpdate({
          file,
          routes: Object.values(routeMap),
        });

        return;
      }

      if (routeMap[file]) {
        await workerPool.handleRouteFileUpdate({
          route: routeMap[file],
        });
        return;
      }
    });
  };

  for (const { file, parser } of await sourceFilesParsers(config, options)) {
    srcWatchers[file] = async () => {
      for (const { route, alias } of await parser()) {
        if (filter(route)) {
          routeMap[route.fileFullpath] = route;
          for (const a of alias) {
            routeMap[a.path] = {
              ...route,
              ...a,
            };
          }
        }
      }
    };
  }

  // populating routeMap for bootstrap
  for (const handler of Object.values(srcWatchers)) {
    await handler();
  }

  const bootstrapPayload: BootstrapPayload<Workers> = {
    appRoot,
    sourceFolder,
    routes: Object.values(routeMap),
  };

  return {
    bootstrapPayload,
    watchHandler,
  };
}
