import { resolve, join } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

import { type Plugin, context, build } from "esbuild";
import type { ResolvedConfig } from "vite";

import type { ResolvedPluginOptions } from "../@types";
import { defaults } from "../defaults";

export async function apiHandlerFactory(
  config: ResolvedConfig,
  options: ResolvedPluginOptions,
) {
  const { root, sourceFolder, apiurl } = options;

  const apiDir = join(defaults.appPrefix, sourceFolder, defaults.apiDir);
  const outDir = resolve(config.build.outDir, join("..", defaults.apiDir));

  const esbuildConfig = await import(resolve(root, "../esbuild.json"), {
    with: { type: "json" },
  }).then((mdl) => mdl.default);

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

    const apiHandler: Plugin = {
      name: "apiHandler",
      setup(build) {
        build.onEnd(async () => {
          try {
            const exports = await import(
              [outfile, new Date().getTime()].join("?")
            );
            app = await exports.default();
          } catch (e) {
            console.error(e);
          }
        });
      },
    };

    const ctx = await context({
      logLevel: "info",
      ...esbuildConfig,
      bundle: true,
      entryPoints: [join(apiDir, "app.ts")],
      plugins: [...(esbuildConfig.plugins || []), apiHandler],
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
        entryPoints: [join(apiDir, "server.ts")],
        plugins: [...(esbuildConfig.plugins || [])],
        outfile: join(
          outDir,
          esbuildConfig.format === "esm" ? "index.mjs" : "index.js",
        ),
      });
    },
  };
}
