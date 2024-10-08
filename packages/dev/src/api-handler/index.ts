import { resolve, join } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

import { type Plugin, context, build } from "esbuild";
import type { ResolvedConfig } from "vite";

import { type PluginOptionsResolved, defaults } from "@/base";

export async function apiHandlerFactory(
  config: ResolvedConfig,
  options: PluginOptionsResolved,
) {
  const { appRoot, sourceFolder, apiurl, apiMiddleware } = options;

  const apiDir = join(sourceFolder, defaults.apiDir);
  const outDir = resolve(config.build.outDir, join("..", defaults.apiDir));

  const esbuildConfig = await import(resolve(appRoot, "esbuild.json"), {
    with: { type: "json" },
  }).then((mdl) => mdl.default);

  let app: InstanceType<typeof import("koa")>;

  const devMiddleware = async (
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
  ) => {
    if (apiMiddleware) {
      const handler = apiMiddleware(app);
      await handler(req, res, next);
    } else {
      req.url?.startsWith(join(config.base, apiurl))
        ? await app?.callback()(req, res)
        : next();
    }
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
