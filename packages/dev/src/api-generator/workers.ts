import { join } from "node:path";

import { APIMethods } from "@appril/api/router";
import { fileGenerator } from "@appril/dev-utils";

import { type ApiRoute, defaults } from "@/base";

import indexTpl from "./templates/index.hbs";
import routeTpl from "./templates/route.hbs";
import routesTpl from "./templates/routes.hbs";

let sourceFolder: string;
let generateFile: ReturnType<typeof fileGenerator>["generateFile"];

export async function bootstrap(data: {
  appRoot: string;
  sourceFolder: string;
  routes: Array<ApiRoute>;
  template: string | undefined;
}) {
  const { routes, template } = data;

  sourceFolder = data.sourceFolder;

  generateFile = fileGenerator(data.appRoot).generateFile;

  await generateFile(defaults.dataSourceFile, "", { overwrite: false });

  for (const route of routes) {
    await generateRouteFiles({ route, template });
  }

  await generateIndexFiles(data.routes);
}

export async function handleSrcFileUpdate({
  file,
  routes,
  template,
}: {
  file: string;
  routes: Array<ApiRoute>;
  template: string | undefined;
}) {
  // making sure newly added routes have files generated
  for (const route of routes.filter((e) => e.srcFile === file)) {
    await generateRouteFiles({ route, template });
  }

  await generateIndexFiles(routes);
}

async function generateRouteFiles({
  route,
  template,
}: { route: ApiRoute; template: string | undefined }) {
  if (!route.optedFile) {
    await generateFile(
      join(
        defaults.varDir,
        sourceFolder,
        defaults.varApiDir,
        route.importPath,
        "index.ts",
      ),
      {
        template: indexTpl,
        context: {
          defaults,
          apiMethods: Object.keys(APIMethods),
          route,
        },
      },
    );
  }

  await generateFile(
    join(sourceFolder, defaults.apiDir, route.file),
    {
      template: template || routeTpl,
      context: {
        route,
        importVarBase: `${sourceFolder}/${defaults.varApiDir}`,
      },
    },
    { overwrite: false },
  );
}

async function generateIndexFiles(routes: Array<ApiRoute>) {
  await generateFile(
    join(
      defaults.varDir,
      sourceFolder,
      defaults.varApiDir,
      defaults.apiRoutesFile,
    ),
    {
      template: routesTpl,
      context: {
        routes: routes
          .map((route) => ({
            ...route,
            ...(route.meta ? { meta: JSON.stringify(route.meta) } : {}),
          }))
          .sort((a, b) => a.path.localeCompare(b.path)),
        importPathCfg: [sourceFolder, defaults.configDir].join("/"),
        importPathApi: [sourceFolder, defaults.apiDir].join("/"),
        importPathVar: [sourceFolder, defaults.varApiDir].join("/"),
      },
    },
  );
}
