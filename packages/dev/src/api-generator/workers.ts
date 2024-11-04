import { join } from "node:path";
import { format } from "node:util";

import { APIMethods } from "@appril/api/router";
import { fileGenerator } from "@appril/dev-utils";

import { type ApiRoute, defaults } from "@/base";

import baseTpl from "./templates/base.hbs";
import indexTpl from "./templates/index.hbs";
import routeTpl from "./templates/route.hbs";
import routesTpl from "./templates/routes.hbs";

let sourceFolder: string;
let generateFile: ReturnType<typeof fileGenerator>["generateFile"];

const libApiDir = format(defaults.libDirFormat, defaults.apiDir);

export async function bootstrap(data: {
  appRoot: string;
  sourceFolder: string;
  routes: Array<ApiRoute>;
  template: string | undefined;
}) {
  const { routes, template } = data;

  sourceFolder = data.sourceFolder;

  generateFile = fileGenerator(data.appRoot).generateFile;

  await generateFile(
    join(defaults.libDir, sourceFolder, libApiDir, "base.ts"),
    { template: baseTpl, context: {} },
  );

  await generateFile(join(sourceFolder, defaults.dataSourceFile), "", {
    overwrite: false,
  });

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
  await generateFile(
    join(
      defaults.libDir,
      sourceFolder,
      libApiDir,
      route.importPath,
      "index.ts",
    ),
    {
      template: indexTpl,
      context: {
        importPathmap: {
          lib: [sourceFolder, libApiDir].join("/"),
        },
        apiMethods: Object.keys(APIMethods),
        route,
      },
    },
  );

  await generateFile(
    join(sourceFolder, defaults.apiDir, route.file),
    {
      template: route.template || template || routeTpl,
      context: {
        route,
        importPathmap: {
          base: [sourceFolder, libApiDir, route.importPath].join("/"),
        },
      },
      format: true,
    },
    { overwrite: false },
  );
}

async function generateIndexFiles(routes: Array<ApiRoute>) {
  await generateFile(
    join(defaults.libDir, sourceFolder, libApiDir, defaults.apiRoutesFile),
    {
      template: routesTpl,
      context: {
        routes: routes
          .map((route) => ({
            ...route,
            ...(route.meta ? { meta: JSON.stringify(route.meta) } : {}),
          }))
          .sort((a, b) => a.path.localeCompare(b.path)),
        importPathmap: {
          config: [sourceFolder, defaults.configDir].join("/"),
          api: [sourceFolder, defaults.apiDir].join("/"),
          lib: [sourceFolder, libApiDir].join("/"),
        },
      },
    },
  );
}
