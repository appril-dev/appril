import { join, dirname } from "node:path";

import type { ApiRoute } from "../@types";
import { defaults } from "../defaults";
import { extractApiAssets } from "../ast";
import { fileGenerator, upsertTsconfigPaths } from "../base";

import baseTpl from "./templates/base.hbs";
import fetchTpl from "./templates/fetch.hbs";
import indexTpl from "./templates/index.hbs";

const { generateFile } = fileGenerator();

let sourceFolder: string;
let sourceFolderPath: string;
let apiDir: string;
let varDir: string;

export async function bootstrap(data: {
  routes: ApiRoute[];
  sourceFolder: string;
  sourceFolderPath: string;
  apiDir: string;
  varDir: string;
}) {
  const { routes } = data;

  sourceFolder = data.sourceFolder;
  sourceFolderPath = data.sourceFolderPath;
  apiDir = data.apiDir;
  varDir = data.varDir;


  await generateFile(join(varDir, defaults.generated.fetch, "base.ts"), {
    template: baseTpl,
    context: {
      sourceFolder,
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
        return join(sourceFolder, apiDir, dirname(route.file), path);
      },
    },
  );

  await generateFile(
    join(varDir, defaults.generated.fetch, apiDir, route.file),
    {
      template: fetchTpl,
      context: {
        ...route,
        baseImportPath: join(
          sourceFolder,
          varDir,
          defaults.generated.fetch,
          "base",
        ),
        defaults,
        typeDeclarations,
        fetchDefinitions,
      },
    },
  );
}

async function generateIndexFiles({
  routes,
}: {
  routes: ApiRoute[];
}) {
  await generateFile(join(varDir, defaults.generated.fetch, "index.ts"), {
    template: indexTpl,
    context: {
      apiDir,
      routes,
    },
  });
}
