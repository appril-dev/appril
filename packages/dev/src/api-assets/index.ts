import { join } from "node:path";

import type {
  ResolvedPluginOptions,
  ApiRoute,
  BootstrapPayload,
  WatchHandler,
} from "../@types";

import { sourceFilesParsers } from "../api-generator/parsers";
import { defaults } from "../defaults";

type Workers = typeof import("./workers");

export async function apiAssets(
  config: import("vite").ResolvedConfig,
  options: ResolvedPluginOptions,
  { workerPool }: { workerPool: Workers },
) {
  const { root, sourceFolder } = options;

  // biome-ignore format:
  const {
    filter = (_r: ApiRoute) => true,
    importZodErrorHandlerFrom,
  } = options.apiAssets;

  const srcWatchers: Record<string, () => Promise<void>> = {};

  const routeMap: Record<string, ApiRoute> = {};

  const parsers = await sourceFilesParsers(config, options);

  const watchHandler: WatchHandler = async (watcher) => {
    for (const pattern of [
      // watching source files for changes
      ...Object.keys(srcWatchers),
      // also watching files in apiDir for changes
      `${join(root, sourceFolder, defaults.apiDir)}/**/*.ts`,
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
        if (filter(routeMap[file])) {
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
        if (filter(route)) {
          routeMap[route.fileFullpath] = route;
        }
      }
    };
  }

  // populating routeMap for bootstrap
  for (const handler of Object.values(srcWatchers)) {
    await handler();
  }

  const bootstrapPayload: BootstrapPayload<Workers> = {
    root,
    sourceFolder,
    outDir: config.build.outDir,
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
