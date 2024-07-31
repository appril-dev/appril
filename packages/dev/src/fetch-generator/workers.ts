import { join, dirname } from "node:path";

import { fileGenerator } from "@appril/utils";

import { type ApiRoute, defaults } from "../base";
import { extractApiAssets } from "../ast";

import baseTpl from "./templates/base.hbs";
import fetchTpl from "./templates/fetch.hbs";
import indexTpl from "./templates/index.hbs";

const { generateFile } = fileGenerator();

let sourceFolder: string;
let sourceFolderPath: string;

export async function bootstrap(data: {
  routes: ApiRoute[];
  sourceFolder: string;
  sourceFolderPath: string;
}) {
  const { routes } = data;

  sourceFolder = data.sourceFolder;
  sourceFolderPath = data.sourceFolderPath;

  await generateFile(join(defaults.varDir, defaults.fetchDir, "base.ts"), {
    template: baseTpl,
    context: {
      importPathFetch: [defaults.basePrefix, defaults.baseDir, "@fetch"].join(
        "/",
      ),
      importPathConfig: [
        defaults.basePrefix,
        sourceFolder,
        defaults.configDir,
      ].join("/"),
    },
  });

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
  routes: ApiRoute[];
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
  const { typeDeclarations, fetchDefinitions } = await extractApiAssets(
    route.fileFullpath,
    {
      relpathResolver(path) {
        return join(
          defaults.basePrefix,
          sourceFolder,
          defaults.apiDir,
          dirname(route.file),
          path,
        );
      },
    },
  );

  await generateFile(
    join(defaults.varDir, defaults.fetchDir, defaults.apiDir, route.file),
    {
      template: fetchTpl,
      context: {
        route,
        sourceFolder,
        typeDeclarations,
        fetchDefinitions,
        importPathBase: [
          defaults.basePrefix,
          sourceFolder,
          defaults.varDir,
          defaults.fetchDir,
          "base",
        ].join("/"),
      },
    },
  );
}

async function generateIndexFiles({
  routes,
}: {
  routes: ApiRoute[];
}) {
  await generateFile(join(defaults.varDir, defaults.fetchDir, "index.ts"), {
    template: indexTpl,
    context: {
      routes: routes
        .map((route) => ({
          ...route,
          importPrefix: [
            defaults.basePrefix,
            sourceFolder,
            defaults.varDir,
            defaults.fetchDir,
            defaults.apiDir,
          ].join("/"),
        }))
        .sort((a, b) => a.path.localeCompare(b.path)),
    },
  });
}
