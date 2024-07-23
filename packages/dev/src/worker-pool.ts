import { Worker } from "node:worker_threads";

import * as apiGenerator from "./api-generator/workers";
import * as apiAssets from "./api-assets/workers";
import * as fetchGenerator from "./fetch-generator/workers";
import * as solidPages from "./solid-pages/workers";

export const workerMap = {
  fetchGenerator,
  solidPages,
  apiAssets,
  apiGenerator,
} as const;

export type WorkerMap = typeof workerMap;

export type WorkerTasks = {
  [K in keyof WorkerMap]: WorkerMap[K];
}[keyof WorkerMap];

// biome-ignore format:
export type BootstrapPayload<
  T extends { bootstrap: (_p: never) => void }
> = Parameters<T["bootstrap"]>[0]

export async function bootstrapWorker(
  payload: Record<string, never>,
  workerPool: WorkerMap,
) {
  const generators = [
    /** order is highly important!
     * thus using array rather than iterating over workerMap */
    "solidPages",
    "fetchGenerator",
    "apiGenerator",
    "apiAssets",
  ] as const;

  for (const generator of generators) {
    // bootstrap only generators defined in payload
    if (payload[generator]) {
      await workerPool[generator].bootstrap(payload[generator]);
    }
  }
}

export function workerFactory(useWorkers: boolean) {
  let worker: Worker | undefined = new Worker(
    new URL("worker.mjs", import.meta.url),
  );

  worker.on("exit", (code) => {
    console.error(`\nWorker Exited with code ${code}`);
    worker = undefined;
  });

  const workerPool: WorkerMap = {
    ...workerMap,
  };

  if (useWorkers) {
    for (const [pool, workers] of Object.entries(workerMap) as [
      k: keyof WorkerMap,
      v: never,
    ][]) {
      // @ts-expect-error read-only property
      workerPool[pool] = Object.keys(workers).reduce(
        (map: Record<string, (data: never) => void>, task) => {
          map[task] = (data) => worker?.postMessage({ pool, task, data });
          return map;
        },
        {},
      );
    }
  }

  const bootstrap = async (payload: Record<string, never>) => {
    useWorkers
      ? worker?.postMessage({ bootstrap: payload })
      : await bootstrapWorker(payload, workerMap);
  };

  return {
    worker,
    workerPool,
    bootstrap,
  };
}
