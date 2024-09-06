import { resolve, basename, join } from "node:path";

import type { FSWatcher, Plugin } from "vite";

import type {
  PluginOptions,
  ResolvedPluginOptions,
  WatchHandler,
} from "./base";

import { workerFactory } from "./worker-pool";

import { apiHandlerFactory } from "./api-handler";
import { apiGenerator } from "./api-generator";
import { apiAssets } from "./api-assets";
import { solidPages } from "./solid-pages";
import { fetchGenerator } from "./fetch-generator";

export type { PluginOptions, ResolvedPluginOptions };

export { defaults } from "./defaults";
export * from "./define";
export * from "./alias";
export * from "./file-bundler";

export default function apprilDevPlugin(options: PluginOptions): Plugin {
  const outDirSuffix = "client";

  let apiHandler: Awaited<ReturnType<typeof apiHandlerFactory>>;

  let setupWatchers: (w: FSWatcher) => Promise<void>;

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
      const resolvedOptions: ResolvedPluginOptions = {
        apiAssets: {},
        apiGenerator: {},
        fetchGenerator: {},
        solidPages: undefined,
        useWorkers: true,
        watchOptions: {
          usePolling: false,
          // wait for the write operation to finish before emit event
          // as occasionally event emitted while the file is being written
          awaitWriteFinish: {
            // Amount of time for a file size to remain constant before emitting its event
            stabilityThreshold: 1_000,
            // File size polling interval
            pollInterval: 250,
          },
        },
        ...options,
        // not overridable by options
        appRoot: resolve(config.root, ".."),
        sourceFolder: basename(config.root),
      };

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

      const watchHandlers: Array<WatchHandler> = [];

      for (const plugin of plugins) {
        const { watchHandler, ...rest } = await plugin(
          config,
          resolvedOptions,
          { workerPool: workerPool[plugin.name as never] },
        );
        bootstrapPayload[plugin.name] = rest.bootstrapPayload as never;
        watchHandlers.push(watchHandler);
      }

      setupWatchers = async (watcher) => {
        await bootstrap(bootstrapPayload);
        // run watchHandlers only after bootstrap
        for (const watchHandler of watchHandlers) {
          // absolutely necessary to await!
          await watchHandler(watcher);
        }
      };

      apiHandler = await apiHandlerFactory(config, resolvedOptions);

      if (config.command === "build") {
        worker.unref();
      }
    },

    async configureServer(server) {
      server.watcher.options = {
        ...server.watcher.options,
        ...options.watchOptions,
      };

      // assuming configureServer always run after configResolved
      await setupWatchers(server.watcher);

      server.middlewares.use(apiHandler.devMiddleware);
    },

    async buildEnd(error) {
      if (!error) {
        await apiHandler?.build();
      }
    },
  };
}
