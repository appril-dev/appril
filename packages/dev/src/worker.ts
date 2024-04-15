import { parentPort } from "node:worker_threads";

import {
  type WorkerMap,
  type WorkerTasks,
  workerMap,
  bootstrapWorker,
} from "./worker-pool";

parentPort?.on("message", async (msg) => {
  if (msg.bootstrap) {
    await bootstrapWorker(msg.bootstrap, workerMap);
    return;
  }

  const {
    pool,
    task,
    data,
  }: {
    pool: keyof WorkerMap;
    task: keyof WorkerTasks;
    data: never;
  } = msg;

  await workerMap[pool]?.[task]?.(data);
});

process.on("uncaughtException", (error) => {
  console.error("UncaughtException", error);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("UnhandledRejection", promise, reason);
});
