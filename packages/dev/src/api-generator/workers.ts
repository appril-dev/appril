import { join } from "node:path";

import { APIMethods } from "@appril/router";

import type { ApiTemplates, ApiRoute } from "../@types";
import { defaults } from "../defaults";
import { fileGenerator } from "../base";
import { BANNER } from "../render";

import baseTpl from "./templates/base.hbs";
import routeTpl from "./templates/route.hbs";
import routesTpl from "./templates/routes.hbs";

const { generateFile } = fileGenerator();

let sourceFolder: string;
let sourceFolderPath: string;

export async function bootstrap(data: {
  routes: ApiRoute[];
  sourceFolder: string;
  sourceFolderPath: string;
  customTemplates: ApiTemplates;
}) {
  const { routes, customTemplates } = data;

  sourceFolder = data.sourceFolder;
  sourceFolderPath = data.sourceFolderPath;

  await generateFile(
    join(defaults.apiDir, defaults.apiDataDir, defaults.apiSourceFile),
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
      join(defaults.varDir, defaults.apiDir, route.importPath, "index.ts"),
      {
        template: baseTpl,
        context: {
          defaults,
          apiMethods: Object.keys(APIMethods),
          route,
        },
      },
    );
  }

  await generateFile(
    join(defaults.apiDir, route.file),
    {
      template: route.template || customTemplates.route || routeTpl,
      context: { route, defaults },
    },
    { overwrite: false },
  );
}

async function generateIndexFiles(_routes: ApiRoute[]) {
  const routes = _routes.map((e) => ({ ...e, meta: JSON.stringify(e.meta) }));
  await generateFile(join(defaults.apiDir, defaults.apiRoutesFile), {
    template: routesTpl,
    context: {
      BANNER,
      routes,
      defaults,
    },
  });
}
