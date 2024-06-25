import { join } from "node:path";

import { APIMethods } from "@appril/router";

import type { ApiTemplates, ApiRoute } from "../@types";
import { defaults } from "../defaults";
import { fileGenerator, upsertTsconfigPaths } from "../base";
import { BANNER } from "../render";

import baseTpl from "./templates/base.hbs";
import routeTpl from "./templates/route.hbs";
import routesTpl from "./templates/routes.hbs";

const { generateFile } = fileGenerator();

let sourceFolder: string;
let sourceFolderPath: string;
let apiDir: string;
let varDir: string;

export async function bootstrap(data: {
  routes: ApiRoute[];
  apiDir: string;
  varDir: string;
  sourceFolder: string;
  sourceFolderPath: string;
  customTemplates: ApiTemplates;
}) {
  const { routes, customTemplates } = data;

  sourceFolder = data.sourceFolder;
  sourceFolderPath = data.sourceFolderPath;
  varDir = data.varDir;
  apiDir = data.apiDir;

  await upsertTsconfigPaths(join(sourceFolderPath, "tsconfig.json"), {
    [`${defaults.generated.api}/*`]: [
      ".",
      varDir,
      defaults.generated.api,
      "*",
    ].join("/"),
  });

  await generateFile(
    join(apiDir, defaults.generated.data, defaults.api.sourceFile),
    "",
    {
      overwrite: false,
    },
  );

  for (const route of routes) {
    await generateRouteFiles({ route, customTemplates });
  }

  await generateIndexFiles(data.routes);
}

export async function handleSrcFileUpdate({
  file,
  routes,
  customTemplates,
}: {
  file: string;
  routes: ApiRoute[];
  customTemplates: ApiTemplates;
}) {
  // making sure newly added routes have files generated
  for (const route of routes.filter((e) => e.srcFile === file)) {
    await generateRouteFiles({ route, customTemplates });
  }

  await generateIndexFiles(routes);
}

async function generateRouteFiles({
  route,
  customTemplates,
}: { route: ApiRoute; customTemplates: ApiTemplates }) {
  if (!route.optedFile) {
    await generateFile(
      join(varDir, defaults.generated.api, route.importPath, "index.ts"),
      {
        template: baseTpl,
        context: {
          sourceFolder,
          apiMethods: Object.keys(APIMethods),
          route,
        },
      },
    );
  }

  await generateFile(
    join(apiDir, route.file),
    {
      template: route.template || customTemplates.route || routeTpl,
      context: { defaults, ...route },
    },
    { overwrite: false },
  );
}

async function generateIndexFiles(_routes: ApiRoute[]) {
  const routes = _routes.map((e) => ({ ...e, meta: JSON.stringify(e.meta) }));
  await generateFile(join(apiDir, defaults.api.routesFile), {
    template: routesTpl,
    context: {
      BANNER,
      apiDir,
      sourceFolder,
      routes,
      defaults,
    },
  });
}
