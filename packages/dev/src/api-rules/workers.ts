import { basename, join } from "node:path";
import { format } from "node:util";
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
  generateRulesFile,
  libFilePath,
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
              defaults.libDir,
              sourceFolder,
              `${format(defaults.libDirFormat, defaults.apiDir)}/`,
            ),
          )
        ) {
          return ["_rules.ts", "_hashmap.json", "_schema.ts"].includes(
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
  routes = data.routes;
  await generateRouteAssets(routes);
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
    // generating a generic rules file
    // to avoid import errors while zod schema generated
    await generateRulesFile(route, {
      appRoot,
      sourceFolder,
      typeDeclarations: [],
      paramsType: undefined,
      payloadTypes: [],
      importZodErrorHandlerFrom,
      overwrite: false, // skip if exists
    });

    const hashmapFile = libFilePath(route, "hashmap", {
      appRoot,
      sourceFolder,
    });

    // generating hashmap file, if not exists
    await generateFile(hashmapFile, "{}", { overwrite: false });
  }

  const staleRoutes: Array<ApiRoute> = [];

  for (const route of routes) {
    const hashmapFile = libFilePath(route, "hashmap", {
      appRoot,
      sourceFolder,
    });

    const hashmap: { default: HashMap } = await import(
      `${hashmapFile}?${new Date().getTime()}`,
      { with: { type: "json" } }
    );

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
            new URL("api-rules/worker.mjs", import.meta.url),
          );

          worker.on(
            "message",
            (msg: {
              discoveredTypeDeclarations?: Array<DiscoveredTypeDeclaration>;
            }) => {
              for (const t of msg.discoveredTypeDeclarations || []) {
                if (t.included) {
                  watchDepFile(t.file, route);
                }
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
