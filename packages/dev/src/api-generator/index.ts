import { resolve } from "node:path";

import type { ResolvedConfig } from "vite";
import fsx from "fs-extra";

import type {
  ResolvedPluginOptions,
  ApiRoute,
  ApiTemplates,
  BootstrapPayload,
} from "../@types";

import { sourceFilesParsers } from "./parsers";

/** {apiDir}/_routes.toml schema:

[some-route]
# will generate {apiDir}/some-route.ts

["account/activate/"]
# will generate {apiDir}/account/activate/index.ts

["account/activate/verify"]
# will generate {apiDir}/account/activate/verify.ts

["some-page.html"]
# will generate {apiDir}/some-page.html.ts

["another-page.html/"]
# will generate {apiDir}/another-page.html/index.ts

## dynamic params

["users/:id"]
# will generate {apiDir}/users/:id.ts

["users/:id.json"]
# will generate {apiDir}/users/:id.json.ts

## optional params (-o suffix)

["users/:id+o"]
# will generate {apiDir}/users/:id+o.ts

## any/rest params (+a suffix)

["cms/:path+a"]
# will generate {apiDir}/cms/:path+a.ts

["cms/:path+a.html"]
# will generate {apiDir}/cms/:path+a.html.ts

## aliases
["users/login"]
alias = "login"
# or
["users/login"]
alias = [ "users/authorize", "login" ]

# dynamic aliases, will serve /users/:id and /customers/:id
["users/:id"]
alias = { find = "users", replace = "customers" }

## provide meta object
["some-route"]
meta = { restricted = true, privileges = { role = "manager" } }

*/

/**
 * Generates multiple files based on {apiDir}/_routes.toml
 *
 * Generated files:
 *    - {apiDir}/{route}.ts (or {apiDir}/{route}/index.ts if path ends in a slash)
 *    - {apiDir}/_routes.ts - importing route files and exporting mapped routes
 *
 * @param {object} [opts={}] - options
 * @param {string} [opts.apiDir="api"] - path to api folder where to place generated files
 * @param {object} [opts.templates={}] - custom templates
 */

type Workers = typeof import("./workers");

export async function apiGenerator(
  config: ResolvedConfig,
  options: ResolvedPluginOptions,
  { workerPool }: { workerPool: Workers },
) {
  const { sourceFolder, sourceFolderPath, apiDir, varDir } = options;

  const routeMap: Record<string, ApiRoute> = {};

  const tplWatchers: Record<string, () => Promise<void>> = {};
  const srcWatchers: Record<string, () => Promise<void>> = {};

  const customTemplates: ApiTemplates = options.apiGenerator?.templates || {};

  const watchHandler = async (file: string) => {
    if (tplWatchers[file]) {
      // updating templates; to be used on newly added routes only
      // so no need to update anything here
      await tplWatchers[file]();
      return;
    }

    if (srcWatchers[file]) {
      // updating routeMap / aliasMap
      await srcWatchers[file]();

      // then feeding them to worker
      await workerPool.handleSrcFileUpdate({
        file,
        routes: Object.values(routeMap),
        customTemplates,
      });

      return;
    }
  };

  // srcWatchers and tplWatchers should be ready by the time configureServer called,
  // so it's safer to run this here rather than inside configResolved
  for (const [name, path] of Object.entries(customTemplates) as [
    name: keyof ApiTemplates,
    file: string,
  ][]) {
    const file = resolve(sourceFolderPath, path);
    tplWatchers[file] = async () => {
      customTemplates[name] = await fsx.readFile(file, "utf8");
    };
  }

  for (const { file, parser } of await sourceFilesParsers(config, options)) {
    srcWatchers[file] = async () => {
      for (const { route, alias } of await parser()) {
        const { path } = route;

        routeMap[path] = route;

        for (const a of alias) {
          routeMap[a.path] = {
            ...route,
            ...a,
          };
        }
      }
    };
  }

  // populating tplWatchers for bootstrap
  for (const handler of Object.values(tplWatchers)) {
    await handler();
  }

  // populating srcWatchers for bootstrap (only call alfter tplWatchers populated)
  for (const handler of Object.values(srcWatchers)) {
    await handler();
  }

  const bootstrapPayload: BootstrapPayload<Workers> = {
    routes: Object.values(routeMap),
    apiDir,
    varDir,
    sourceFolder,
    sourceFolderPath,
    customTemplates,
  };

  return {
    bootstrapPayload,
    watchHandler,
    watchPatterns: [...Object.keys(tplWatchers), ...Object.keys(srcWatchers)],
  };
}
