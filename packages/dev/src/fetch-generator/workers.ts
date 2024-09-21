import { join, dirname } from "node:path";

import { fileGenerator } from "@appril/dev-utils";

import { type ApiRoute, defaults } from "@/base";
import { extractApiAssets } from "@/ast";

import baseTpl from "./templates/base.hbs";
import fetchTpl from "./templates/fetch.hbs";
import indexTpl from "./templates/index.hbs";

let sourceFolder: string;
let generateFile: ReturnType<typeof fileGenerator>["generateFile"];

export async function bootstrap(data: {
  appRoot: string;
  sourceFolder: string;
  routes: Array<ApiRoute>;
}) {
  const { routes } = data;

  sourceFolder = data.sourceFolder;

  generateFile = fileGenerator(data.appRoot).generateFile;

  await generateFile(
    join(defaults.varDir, sourceFolder, defaults.varFetchDir, "base.ts"),
    {
      template: baseTpl,
      context: { defaults, sourceFolder },
    },
  );

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
        return join(sourceFolder, defaults.apiDir, dirname(route.file), path);
      },
    },
  );

  await generateFile(
    join(
      defaults.varDir,
      sourceFolder,
      defaults.varFetchDir,
      defaults.apiDir,
      route.file,
    ),
    {
      template: fetchTpl,
      context: {
        route,
        typeDeclarations,
        fetchDefinitions,
        sourceFolder,
        defaults,
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
    join(defaults.varDir, sourceFolder, defaults.varFetchDir, "index.ts"),
    {
      template: indexTpl,
      context: {
        importVarBase: [
          sourceFolder,
          defaults.varFetchDir,
          defaults.apiDir,
        ].join("/"),
        routes: routes.sort((a, b) => a.path.localeCompare(b.path)),
      },
    },
  );
}
