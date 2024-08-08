import { cpus } from "node:os";
import { resolve, join } from "node:path";
import { Worker } from "node:worker_threads";

import type { ResolvedConfig } from "vite";
import chokidar, { type FSWatcher } from "chokidar";
import { chunk } from "lodash-es";
import { fileGenerator } from "@appril/dev-utils";

import { defaults, type ApiRoute, type ResolvedPluginOptions } from "../base";

import {
  type DerivedRoute,
  type WorkerPayload,
  type DiscoveredTypeDeclaration,
  type HashMap,
  extractDepFiles,
  identicalHashMap,
  generateAssetsFile,
} from "./base";

// absolute path to sourceFolder
let root: string;
let sourceFolder: string;
// exposing routes to be updateable by handleSrcFileUpdate
// then later consumed by watchers
let routes: Array<ApiRoute>;
let importZodErrorHandlerFrom: string | undefined;
let generateFile: ReturnType<typeof fileGenerator>["generateFile"];

// route files may import type files from anywhere
// but vite does not watch files outside root
// so using a custom watcher here.
// wrt performance/conflicts - watcher runs inside a worker
// so should not affect plugin/vite at all
let watcher: FSWatcher | undefined;

const depsMap: Record<string, Set<string>> = {};

function watchDepFile(file: string, route: DerivedRoute) {
  if (!depsMap[file]) {
    depsMap[file] = new Set();
    watcher?.add(file);
  }
  depsMap[file].add(route.fileFullpath);
}

export async function bootstrap(data: {
  root: string;
  sourceFolder: string;
  outDir: string;
  command: ResolvedConfig["command"];
  watchOptions: ResolvedPluginOptions["watchOptions"];
  routes: Array<ApiRoute>;
  importZodErrorHandlerFrom?: string;
}) {
  root = data.root;
  sourceFolder = data.sourceFolder;
  routes = data.routes;
  importZodErrorHandlerFrom = data.importZodErrorHandlerFrom;
  generateFile = fileGenerator(data.root).generateFile;

  const appRoot = resolve(root, "..");

  if (data.command === "serve") {
    watcher = chokidar.watch(appRoot, {
      ...data.watchOptions,
      ignored: [
        "**/.git/**",
        "**/node_modules/**",
        `${data.outDir}/**`,
        // excluding varDir to avoid infinite circular rebuilds
        `${appRoot}/**/${defaults.varDir}/**`,
      ],
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

async function generateRouteAssets(_routes: Array<ApiRoute>) {
  const routes: Array<DerivedRoute> = _routes.flatMap((route) => {
    const appDir = resolve(root, "..");
    const varDir = join(
      root,
      defaults.varDir,
      defaults.apiDir,
      route.importPath,
    );
    return route.optedFile
      ? []
      : [
          {
            ...route,
            appDir,
            srcDir: root,
            varDir,
            hashmapFile: join(varDir, "@hashmap.json"),
            schemaFile: join(varDir, "@schema.ts"),
            assetsFile: join(varDir, "@assets.ts"),
          },
        ];
  });

  for (const route of routes) {
    // generating a generic assets file
    // to avoid import errors while zod schema generated
    await generateAssetsFile(route, {
      typeDeclarations: [],
      payloadTypes: [],
      importZodErrorHandlerFrom,
      overwrite: false, // skip if exists
    });

    // generating hashmap file, if not exists
    await generateFile(route.hashmapFile, "{}", { overwrite: false });
  }

  const staleRoutes: Array<DerivedRoute> = [];

  for (const route of routes) {
    const hashmap: { default: HashMap } = await import(route.hashmapFile, {
      with: { type: "json" },
    });

    for (const file of extractDepFiles(route, hashmap.default)) {
      watchDepFile(file, route);
    }

    if (await identicalHashMap(route, hashmap.default)) {
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
            sourceFolder,
            importZodErrorHandlerFrom,
          } satisfies WorkerPayload);
        });
      }),
    );
  }
}
