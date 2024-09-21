import { basename, join } from "node:path";
import { cpus } from "node:os";
import { Worker } from "node:worker_threads";

import type { ResolvedConfig } from "vite";
import chokidar, { type FSWatcher } from "chokidar";
import { chunk } from "lodash-es";
import { fileGenerator } from "@appril/dev-utils";

import { defaults, type ApiRoute, type PluginOptionsResolved } from "@/base";

import {
  type WorkerPayload,
  type DiscoveredTypeDeclaration,
  type HashMap,
  extractDepFiles,
  identicalHashMap,
  generateAssetsFile,
  varFilePath,
} from "./base";

let appRoot: string;
let sourceFolder: string;

// exposing routes to be updateable by handleSrcFileUpdate
// then later consumed by watchers
let routes: Array<ApiRoute>;

let importZodErrorHandlerFrom: string | undefined;
let generateFile: ReturnType<typeof fileGenerator>["generateFile"];

// route files may import type files from anywhere
// but vite does not watch files outside root
let watcher: FSWatcher | undefined;

const depsMap: Record<string, Set<string>> = {};

function watchDepFile(file: string, route: ApiRoute) {
  if (!depsMap[file]) {
    depsMap[file] = new Set();
    watcher?.add(file);
  }
  depsMap[file].add(route.fileFullpath);
}

export async function bootstrap(data: {
  appRoot: string;
  sourceFolder: string;
  outDir: string;
  command: ResolvedConfig["command"];
  watchOptions: PluginOptionsResolved["watchOptions"];
  routes: Array<ApiRoute>;
  importZodErrorHandlerFrom?: string;
}) {
  appRoot = data.appRoot;
  sourceFolder = data.sourceFolder;
  routes = data.routes;
  importZodErrorHandlerFrom = data.importZodErrorHandlerFrom;
  generateFile = fileGenerator(appRoot).generateFile;

  if (data.command === "serve") {
    watcher = chokidar.watch(appRoot, {
      ...data.watchOptions,
      ignored: (path) => {
        if (path.startsWith(`${data.outDir}/`)) {
          return true;
        }
        if (
          path.startsWith(
            join(
              appRoot,
              defaults.varDir,
              sourceFolder,
              `${defaults.varApiDir}/`,
            ),
          )
        ) {
          return ["@assets.ts", "@hashmap.json", "@schema.ts"].includes(
            basename(path),
          );
        }
        return ["/.git/", "/node_modules/"].some((e) => path.includes(e));
      },
    });

    watcher.on("change", async (file) => {
      if (depsMap[file]) {
        for (const rFile of depsMap[file]) {
          await generateRouteAssets(
            // using exposed routes rather than data.routes
            // cause routes updated by handleSrcFileUpdate
            routes.filter((e) => e.fileFullpath === rFile),
          );
        }
      }
    });
  }

  await generateRouteAssets(routes);
}

export async function handleSrcFileUpdate(data: {
  file: string;
  routes: Array<ApiRoute>;
}) {
  const newRoutes = data.routes.flatMap((route) => {
    if (routes.some((e) => e.fileFullpath === route.fileFullpath)) {
      return [];
    }
    // adding new route to exposed routes to be used later on watchers
    routes.push(route);
    return [route];
  });

  // making sure newly added routes have assets generated
  await generateRouteAssets(newRoutes);
}

export async function handleRouteFileUpdate({
  route,
}: {
  route: ApiRoute;
}) {
  await generateRouteAssets([route]);
}

async function generateRouteAssets(routes: Array<ApiRoute>) {
  for (const route of routes) {
    // generating a generic assets file
    // to avoid import errors while zod schema generated
    await generateAssetsFile(route, {
      appRoot,
      sourceFolder,
      typeDeclarations: [],
      payloadTypes: [],
      importZodErrorHandlerFrom,
      overwrite: false, // skip if exists
    });

    const hashmapFile = varFilePath(route, "hashmap", {
      appRoot,
      sourceFolder,
    });

    // generating hashmap file, if not exists
    await generateFile(hashmapFile, "{}", { overwrite: false });
  }

  const staleRoutes: Array<ApiRoute> = [];

  for (const route of routes) {
    const hashmapFile = varFilePath(route, "hashmap", {
      appRoot,
      sourceFolder,
    });

    const hashmap: { default: HashMap } = await import(hashmapFile, {
      with: { type: "json" },
    });

    for (const file of extractDepFiles(route, hashmap.default, { appRoot })) {
      watchDepFile(file, route);
    }

    if (await identicalHashMap(route, hashmap.default, { appRoot })) {
      continue;
    }

    staleRoutes.push(route);
  }

  // running in parallel to make use of all cpu cores.
  // splitting tasks into batches, each batch runs N workers at time.
  for (const batch of chunk(staleRoutes, cpus().length)) {
    await Promise.allSettled(
      batch.map((route) => {
        return new Promise((resolve) => {
          const worker = new Worker(
            new URL("api-assets/worker.mjs", import.meta.url),
          );

          worker.on(
            "message",
            (msg: {
              discoveredTypeDeclarations?: Array<DiscoveredTypeDeclaration>;
            }) => {
              for (const { file } of msg.discoveredTypeDeclarations || []) {
                watchDepFile(file, route);
              }
            },
          );

          worker.on("exit", (code) => {
            worker.unref();
            resolve(code);
          });

          worker.postMessage({
            route,
            appRoot,
            sourceFolder,
            importZodErrorHandlerFrom,
          } satisfies WorkerPayload);
        });
      }),
    );
  }
}
