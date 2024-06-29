import { basename, join } from "node:path";

import type { Plugin } from "vite";

import type { PluginOptions, ResolvedPluginOptions } from "./@types";
import { resolvePath } from "./base";
import { customizableDefaults } from "./defaults";

import { workerFactory } from "./worker-pool";

import { apiHandlerFactory } from "./api-handler";
import { apiGenerator } from "./api-generator";
import { apiAssets } from "./api-assets";
import { solidPages } from "./solid-pages";
import { fetchGenerator } from "./fetch-generator";
import { crudGenerator } from "./crud-generator";

export type { PluginOptions, ResolvedPluginOptions };

export * from "./define";
export * from "./file-bundler";

export default function apprilDevPlugin(options: PluginOptions): Plugin {
  const sourceFolderPath = resolvePath();

  const resolvedOptions: ResolvedPluginOptions = {
    ...customizableDefaults,
    apiAssets: {},
    apiGenerator: {},
    fetchGenerator: {},
    solidPages: undefined,
    crudGenerator: undefined,
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
        throw new Error("Config is missing build.outDir");
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
        ...(resolvedOptions.crudGenerator ? [crudGenerator] : []),
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
