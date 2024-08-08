import { Worker } from "node:worker_threads";

import * as apiGenerator from "./api-generator/workers";
import * as apiAssets from "./api-assets/workers";
import * as fetchGenerator from "./fetch-generator/workers";
import * as solidPages from "./solid-pages/workers";

// order is highly important but still can use an object
// cause Object.keys returns string keys in the order they was added
export const workerMap = {
  solidPages,
  fetchGenerator,
  apiGenerator,
  apiAssets,
};

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
  for (const generator of Object.keys(workerMap) as Array<keyof WorkerMap>) {
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
    worker?.unref();
    worker = undefined;
  });

  const workerPool: WorkerMap = { ...workerMap };

  if (useWorkers) {
    for (const [pool, workers] of Object.entries(workerPool)) {
      const reducer = (
        map: Record<string, (data: never) => void>,
        task: string,
      ) => {
        map[task] = (data) => worker?.postMessage({ pool, task, data });
        return map;
      };
      Object.assign(workerPool, {
        [pool]: Object.keys(workers).reduce(reducer, {}),
      });
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
