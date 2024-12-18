import { basename, join } from "node:path";
import { format } from "node:util";
import { Worker } from "node:worker_threads";

import type { ResolvedConfig } from "vite";
import chokidar, { type FSWatcher } from "chokidar";
import { chunk } from "lodash-es";
import { fileGenerator, renderToFile } from "@appril/dev-utils";

import { type ApiRoute, type PluginOptionsResolved, defaults } from "@/base";
import type { DiscoveredTypeDeclaration } from "@/ast";

import {
  type WorkerPayload,
  type HashMap,
  extractDepFiles,
  identicalHashMap,
  generateRulesFile,
  libFilePath,
} from "./base";

import { generateOpenapiSpec } from "../openapi-generator";

import zodTpl from "./templates/zod.hbs";

let appRoot: string;
let sourceFolder: string;

// exposing routes to be updateable by handleSrcFileUpdate
// then later consumed by watchers
let routes: Array<ApiRoute>;

let maxCpus: number;
let traverseMaxDepth: number;
let importZodErrorHandlerFrom: string | undefined;
let openapi: PluginOptionsResolved["openapi"];
let generateFile: ReturnType<typeof fileGenerator>["generateFile"];

// api routes may import files that are not watched by vite
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
  maxCpus: number;
  traverseMaxDepth: number;
  importZodErrorHandlerFrom?: string;
  openapi: PluginOptionsResolved["openapi"];
}) {
  appRoot = data.appRoot;
  sourceFolder = data.sourceFolder;
  routes = data.routes;
  maxCpus = data.maxCpus;
  traverseMaxDepth = data.traverseMaxDepth;
  openapi = data.openapi;
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
      payloadTypes: [],
      responseTypes: [],
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

  // running in parallel to make use of multiple cpu cores.
  // splitting tasks into batches, each batch runs maxCpus workers at time.
  for (const batch of chunk(staleRoutes, maxCpus)) {
    await Promise.allSettled(
      batch.map((route) => {
        return new Promise((resolve) => {
          const worker = new Worker(
            new URL("api-rules/worker.mjs", import.meta.url),
          );

          worker.on(
            "message",
            (msg: {
              referencedTypeDeclarations?: Array<DiscoveredTypeDeclaration>;
            }) => {
              for (const t of msg.referencedTypeDeclarations || []) {
                watchDepFile(t.file, route);
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
            traverseMaxDepth,
            importZodErrorHandlerFrom,
          } satisfies WorkerPayload);
        });
      }),
    );
  }

  await generateSideAssets();
}

async function generateSideAssets() {
  const apiLibDir = format(defaults.libDirFormat, defaults.apiDir);

  const zodFile = join(
    appRoot,
    defaults.libDir,
    sourceFolder,
    apiLibDir,
    "zod.ts",
  );

  await renderToFile(zodFile, zodTpl, {
    routes,
    importPathmap: {
      lib: [defaults.appPrefix, defaults.libDir, sourceFolder, apiLibDir].join(
        "/",
      ),
    },
  });

  if (openapi) {
    await generateOpenapiSpec({
      openapi,
      routes,
      appRoot,
      sourceFolder,
      zodFile,
    });
  }
}
