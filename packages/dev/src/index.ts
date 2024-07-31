import { basename, join } from "node:path";

import type { Plugin } from "vite";
import { resolveCwd } from "@appril/utils";

import type {
  ApiRouteConfig,
  PluginOptions,
  ResolvedPluginOptions,
} from "./base";

import { workerFactory } from "./worker-pool";

import { apiHandlerFactory } from "./api-handler";
import { apiGenerator } from "./api-generator";
import { apiAssets } from "./api-assets";
import { solidPages } from "./solid-pages";
import { fetchGenerator } from "./fetch-generator";

export type { ApiRouteConfig, PluginOptions, ResolvedPluginOptions };

export * from "./defaults";
export * from "./define";
export * from "./file-bundler";

export default function apprilDevPlugin(options: PluginOptions): Plugin {
  const sourceFolderPath = resolveCwd();

  const resolvedOptions: ResolvedPluginOptions = {
    apiAssets: {},
    apiGenerator: {},
    fetchGenerator: {},
    solidPages: undefined,
    useWorkers: true,
    usePolling: true,
    ...options,
    // not overridable by options
    sourceFolder: basename(sourceFolderPath),
    sourceFolderPath,
  };

  const outDirSuffix = "client";

  let apiHandler: Awaited<ReturnType<typeof apiHandlerFactory>>;

  const watchMap: {
    watchPatterns: string[];
    watchHandler: (file: string) => Promise<void>;
  }[] = [];

  return {
    name: "@appril:dev",

    config(config) {
      if (!config.build?.outDir) {
        throw new Error("config is missing build.outDir");
      }
      return {
        build: {
          outDir: join(config.build.outDir, outDirSuffix),
        },
      };
    },

    async configResolved(config) {
      const { worker, workerPool, bootstrap } = workerFactory(
        config.command === "build" ? false : resolvedOptions.useWorkers,
      );

      const bootstrapPayload: Record<string, never> = {};

      const plugins = [
        fetchGenerator,
        apiAssets,
        apiGenerator,
        ...(resolvedOptions.solidPages ? [solidPages] : []),
      ];

      for (const plugin of plugins) {
        const { watchPatterns, watchHandler, ...rest } = await plugin(
          config,
          resolvedOptions,
          { worker, workerPool: workerPool[plugin.name as never] },
        );
        bootstrapPayload[plugin.name] = rest.bootstrapPayload as never;
        watchMap.push({ watchPatterns, watchHandler });
      }

      await bootstrap(bootstrapPayload);

      apiHandler = await apiHandlerFactory(config, resolvedOptions);

      if (config.command === "build") {
        worker.unref();
      }
    },

    async configureServer(server) {
      server.watcher.options = {
        ...server.watcher.options,
        disableGlobbing: false,
        usePolling: resolvedOptions.usePolling,
      };

      for (const { watchPatterns } of watchMap) {
        server.watcher.add(watchPatterns);
      }

      server.watcher.on("change", async (file) => {
        for (const { watchHandler } of watchMap) {
          // passing file through every handler
          // cause same file may be watched by multiple generators
          await watchHandler(file);
        }
      });

      server.middlewares.use(apiHandler.devMiddleware);
    },

    async buildEnd(error) {
      if (!error) {
        await apiHandler?.build();
      }
    },
  };
}
