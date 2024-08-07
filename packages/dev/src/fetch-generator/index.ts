import { resolve } from "node:path";

import type { ResolvedConfig } from "vite";

import type {
  ResolvedPluginOptions,
  ApiRoute,
  BootstrapPayload,
} from "../@types";

import { sourceFilesParsers } from "../api-generator/parsers";
import { defaults } from "../defaults";

type Workers = typeof import("./workers");

export async function fetchGenerator(
  config: ResolvedConfig,
  options: ResolvedPluginOptions,
  { workerPool }: { workerPool: Workers },
) {
  const { sourceFolder, sourceFolderPath } = options;

  const { filter = (_r: ApiRoute) => true } = options.fetchGenerator;

  const srcWatchers: Record<string, () => Promise<void>> = {};

  const routeMap: Record<string, ApiRoute> = {};

  const watchHandler = async (file: string) => {
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
  };

  for (const { file, parser } of await sourceFilesParsers(config, options)) {
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
    routes: Object.values(routeMap),
    sourceFolder,
    sourceFolderPath,
  };

  return {
    bootstrapPayload,
    watchHandler,
    watchPatterns: [
      // watching source files for changes
      ...Object.keys(srcWatchers),
      // also watching files in apiDir for changes
      ...[`${resolve(sourceFolderPath, defaults.apiDir)}/**/*.ts`],
    ],
  };
}
