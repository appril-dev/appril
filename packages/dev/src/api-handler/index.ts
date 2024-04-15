import { resolve, join } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

import { type Plugin, context, build } from "esbuild";
import type { ResolvedConfig } from "vite";

import type { ResolvedPluginOptions } from "../@types";

export async function apiHandlerFactory(
  config: ResolvedConfig,
  options: ResolvedPluginOptions,
) {
  const { esbuildConfig, sourceFolder, apiurl, apiDir } = options;
  const outDir = resolve(config.build.outDir, join("..", apiDir));

  let app: {
    callback: () => (
      req: IncomingMessage,
      res: ServerResponse,
    ) => Promise<void>;
  };

  const devMiddleware = async (
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
  ) => {
    req.url?.startsWith(join(config.base, apiurl))
      ? await app?.callback()(req, res)
      : next();
  };

  if (config.command === "serve") {
    const outfile = join(outDir, "dev.mjs");

    const hmrHandler: Plugin = {
      name: "hmrHandler",
      setup(build) {
        build.onEnd(async () => {
          const exports = await import(
            [outfile, new Date().getTime()].join("?")
          );
          app = exports.app;
        });
      },
    };

    const ctx = await context({
      logLevel: "info",
      ...esbuildConfig,
      bundle: true,
      entryPoints: [join(sourceFolder, apiDir, "app.ts")],
      plugins: [...(esbuildConfig.plugins || []), hmrHandler],
      outfile,
    });

    await ctx.watch();
  }

  return {
    devMiddleware,
    build: async () => {
      await build({
        ...esbuildConfig,
        bundle: true,
        entryPoints: [join(sourceFolder, apiDir, "server.ts")],
        plugins: [...(esbuildConfig.plugins || [])],
        outfile: join(
          outDir,
          esbuildConfig.format === "esm" ? "index.mjs" : "index.js",
        ),
      });
    },
  };
}
