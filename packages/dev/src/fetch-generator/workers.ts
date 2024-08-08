import { join, dirname } from "node:path";

import { fileGenerator } from "@appril/dev-utils";

import { type ApiRoute, defaults } from "../base";

import baseTpl from "./templates/base.hbs";
import fetchTpl from "./templates/fetch.hbs";
import indexTpl from "./templates/index.hbs";
import { extractApiAssets } from "../ast";

let sourceFolder: string;
let generateFile: ReturnType<typeof fileGenerator>["generateFile"];

export async function bootstrap(data: {
  root: string;
  sourceFolder: string;
  routes: Array<ApiRoute>;
}) {
  const { routes } = data;

  sourceFolder = data.sourceFolder;

  generateFile = fileGenerator(data.root).generateFile;

  await generateFile(join(defaults.varDir, defaults.fetchDir, "base.ts"), {
    template: baseTpl,
    context: {
      importPathFetch: [defaults.appPrefix, defaults.baseDir, "@fetch"].join(
        "/",
      ),
      importPathConfig: [
        defaults.appPrefix,
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
  const { typeDeclarations, fetchDefinitions } = await extractApiAssets(
    route.fileFullpath,
    {
      relpathResolver(path) {
        return join(
          defaults.appPrefix,
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
          defaults.appPrefix,
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
  routes: Array<ApiRoute>;
}) {
  await generateFile(join(defaults.varDir, defaults.fetchDir, "index.ts"), {
    template: indexTpl,
    context: {
      routes: routes
        .map((route) => ({
          ...route,
          importPrefix: [
            defaults.appPrefix,
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
