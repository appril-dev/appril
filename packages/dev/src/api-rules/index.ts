import { resolve, join } from "node:path";

import {
  type PluginOptionsResolved,
  type ApiRoute,
  type BootstrapPayload,
  type WatchHandler,
  defaults,
} from "@/base";

import { sourceFilesParsers } from "@/api-generator/parsers";

type Workers = typeof import("./workers");

export async function apiRules(
  config: import("vite").ResolvedConfig,
  options: PluginOptionsResolved,
  { workerPool }: { workerPool: Workers },
) {
  const { appRoot, sourceFolder } = options;

  // biome-ignore format:
  const {
    importZodErrorHandlerFrom,
  } = options.apiRules;

  const srcWatchers: Record<string, () => Promise<void>> = {};

  const routeMap: Record<string, ApiRoute> = {};

  const parsers = await sourceFilesParsers(config, options);

  const watchHandler: WatchHandler = async (watcher) => {
    for (const pattern of [
      // watching source files for changes
      ...Object.keys(srcWatchers),
      // also watching files in apiDir for changes
      `${join(config.root, defaults.apiDir)}/**/*.ts`,
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
        // some route updated, rebuilding assets
        if (routeMap[file]) {
          await workerPool.handleRouteFileUpdate({
            route: routeMap[file],
          });
        }
        return;
      }
    });
  };

  for (const { file, parser } of parsers) {
    srcWatchers[file] = async () => {
      for (const { route } of await parser()) {
        routeMap[route.fileFullpath] = route;
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
    // at initialization, outDir is getting "client" suffix, removing it
    outDir: resolve(config.build.outDir, ".."),
    command: config.command,
    watchOptions: options.watchOptions,
    routes: Object.values(routeMap),
    importZodErrorHandlerFrom,
  };

  return {
    bootstrapPayload,
    watchHandler,
  };
}
