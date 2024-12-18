import { join, dirname } from "node:path";
import { format } from "node:util";

import { fileGenerator } from "@appril/dev-utils";

import { type ApiRoute, defaults } from "@/base";
import { extractApiAssets } from "@/ast";

import fetchTpl from "./templates/fetch.hbs";
import indexTpl from "./templates/index.hbs";

let sourceFolder: string;
let generateFile: ReturnType<typeof fileGenerator>["generateFile"];

const libFetchDir = format(defaults.libDirFormat, defaults.fetchDir);

export async function bootstrap(data: {
  appRoot: string;
  sourceFolder: string;
  routes: Array<ApiRoute>;
}) {
  const { routes } = data;

  sourceFolder = data.sourceFolder;

  generateFile = fileGenerator(data.appRoot).generateFile;

  for (const route of routes) {
    await generateRouteAssets({ route });
  }

  await generateIndexFiles({ routes });
}

export async function handleSrcFileUpdate({
  file,
  routes,
}: {
  file: string;
  routes: Array<ApiRoute>;
}) {
  // making sure newly added routes have assets generated
  for (const route of routes.filter((e) => e.srcFile === file)) {
    await generateRouteAssets({ route });
  }

  await generateIndexFiles({ routes });
}

export async function handleRouteFileUpdate({
  route,
}: {
  route: ApiRoute;
}) {
  await generateRouteAssets({ route });
}

async function generateRouteAssets({
  route,
}: {
  route: ApiRoute;
}) {
  const { typeDeclarations, routeSpecSignatures } = await extractApiAssets({
    route,
    relpathResolver(path) {
      return join(sourceFolder, defaults.apiDir, dirname(route.file), path);
    },
  });

  await generateFile(
    join(
      defaults.libDir,
      sourceFolder,
      libFetchDir,
      defaults.apiDir,
      route.file,
    ),
    {
      template: fetchTpl,
      context: {
        route,
        typeDeclarations,
        routeSpecSignatures,
        importPathmap: {
          config: [sourceFolder, defaults.configDir].join("/"),
          fetchFile: [defaults.appPrefix, defaults.coreDir, "fetch"].join("/"),
        },
      },
    },
  );
}

async function generateIndexFiles({
  routes,
}: {
  routes: Array<ApiRoute>;
}) {
  await generateFile(
    join(defaults.libDir, sourceFolder, libFetchDir, "index.ts"),
    {
      template: indexTpl,
      context: {
        routes: routes.sort((a, b) => a.path.localeCompare(b.path)),
        importPathmap: {
          lib: [sourceFolder, libFetchDir, defaults.apiDir].join("/"),
        },
      },
    },
  );
}
