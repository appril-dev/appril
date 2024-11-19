import { parentPort } from "node:worker_threads";
import { join, resolve } from "node:path";

import fsx from "fs-extra";
import { build as esbuild } from "esbuild";
import type { HTTPMethod } from "@appril/api";

import {
  type RouteConfig,
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  OpenApiGeneratorV31,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";

import type { Payload } from ".";

parentPort?.on("message", worker);

process.on("uncaughtException", (error) => {
  console.error("Failed generating openapi spec");
  console.error("UncaughtException", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Failed generating openapi spec");
  console.error("UnhandledRejection", promise, reason);
  process.exit(1);
});

async function worker({
  openapi,
  routes,
  appRoot,
  sourceFolder,
  zodFile,
}: Payload) {
  const { z, ...schemas } = await importFile<
    {
      z: never;
    } & Record<
      string,
      {
        params: never;
        payload: Record<HTTPMethod, never>;
        response: Record<HTTPMethod, never>;
      }
    >
  >(zodFile);

  extendZodWithOpenApi(z);

  const registry = new OpenAPIRegistry();

  for (const { importName, pathTokens } of routes) {
    const path = pathTokens
      .map((e) => (e.param ? `{${e.param.name}}` : e.orig))
      .join("/");

    const { params, payload, response } = schemas[importName];

    for (const [httpMethod, responseSchema] of Object.entries(
      response,
    ) as Array<[HTTPMethod, never]>) {
      const request: RouteConfig["request"] = {
        params,
      };

      if (payload[httpMethod]) {
        if (["GET", "HEAD", "DELETE"].includes(httpMethod)) {
          request.query = payload[httpMethod];
        } else {
          request.body = {
            content: { "application/json": { schema: payload[httpMethod] } },
            description: "",
          };
        }
      }

      registry.registerPath({
        method: httpMethod.toLowerCase() as never,
        path: `/${path}`,
        request,
        responses: {
          200: {
            content: { "application/json": { schema: responseSchema } },
            description: "",
          },
          204: {
            description: "No content - successful operation",
          },
        },
      });
    }
  }

  const generator = openapi.openapi.startsWith("3.1.")
    ? new OpenApiGeneratorV31(registry.definitions)
    : new OpenApiGeneratorV3(registry.definitions);

  const doc = generator.generateDocument(openapi);

  await fsx.outputJson(
    resolve(join(appRoot, sourceFolder), openapi.outfile),
    doc,
    { spaces: 2 },
  );

  process.nextTick(() => process.exit(0));
}

async function importFile<T>(
  // absolute path
  file: string,
): Promise<T> {
  const outfile = `${file}.${new Date().getTime()}.mjs`;

  await esbuild({
    entryPoints: [file],
    outfile,
    sourcemap: false,
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
    logLevel: "error",
    // coming from esbuild (define option)
    target: `node${String(process.env.APPRIL__NODE_VERSION).split(".")[0]}`,
  });

  let data: T;

  try {
    data = await import(outfile);
  } finally {
    await fsx.unlink(outfile);
  }

  return data;
}
