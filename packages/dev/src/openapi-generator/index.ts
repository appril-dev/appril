import { Worker } from "node:worker_threads";

import type { ApiRoute, PluginOptions } from "../types";

export type Payload = {
  openapi: Required<PluginOptions>["openapi"];
  routes: Array<ApiRoute>;
  appRoot: string;
  sourceFolder: string;
  zodFile: string;
};

export async function generateOpenapiSpec(payload: Payload) {
  await new Promise((resolve) => {
    const worker = new Worker(
      new URL("openapi-generator/worker.mjs", import.meta.url),
    );

    worker.on("exit", (code) => {
      worker.unref();
      resolve(code);
    });

    worker.postMessage(payload);
  });
}
