import { dirname, join } from "node:path";
import { parentPort } from "node:worker_threads";

import { generate } from "ts-to-zod";

import type { ApiRoute, TypeFile } from "../@types";
import { fileGenerator } from "../base";
import { render } from "../render";
import { extractApiAssets } from "../ast";
import { defaults } from "../defaults";

import schemaSourceTpl from "./templates/schema-source.hbs";
import assetsTpl from "./templates/assets.hbs";

const { generateFile } = fileGenerator();

let sourceFolder: string;
let apiDir: string;
let varDir: string;
let importZodErrorHandlerFrom: string | undefined;

export async function bootstrap(data: {
  routes: ApiRoute[];
  sourceFolder: string;
  apiDir: string;
  varDir: string;
  typeFiles: TypeFile[];
  importZodErrorHandlerFrom?: string;
}) {
  const { routes, typeFiles } = data;

  sourceFolder = data.sourceFolder;
  apiDir = data.apiDir;
  varDir = data.varDir;
  importZodErrorHandlerFrom = data.importZodErrorHandlerFrom;

  for (const route of routes) {
    await generateRouteAssets({ route, typeFiles });
  }
}

export async function handleSrcFileUpdate({
  file,
  routes,
  typeFiles,
}: {
  file: string;
  routes: ApiRoute[];
  typeFiles: TypeFile[];
}) {
  // making sure newly added routes have assets generated
  for (const route of routes.filter((e) => e.srcFile === file)) {
    await generateRouteAssets({ route, typeFiles });
  }
}

export async function handleRouteFileUpdate({
  route,
  typeFiles,
}: {
  route: ApiRoute;
  typeFiles: TypeFile[];
}) {
  await generateRouteAssets({ route, typeFiles });
}

async function generateRouteAssets({
  route,
  typeFiles,
}: {
  route: ApiRoute;
  typeFiles: TypeFile[];
}) {
  if (route.optedFile) {
    return;
  }

  const { typeDeclarations, middleworkerPayloadTypes } = await extractApiAssets(
    route.fileFullpath,
    {
      relpathResolver(path) {
        return join(sourceFolder, apiDir, dirname(route.file), path);
      },
    },
  );

  const payloadTypes = Object.entries(middleworkerPayloadTypes).map(
    ([index, text]) => {
      return {
        id: `$__payloadValidation${padStart(index, 3)}__`,
        index,
        text,
      };
    },
  );

  const typeLiterals: string[] = [];

  for (const t of typeDeclarations.filter((e) => !e.importDeclaration)) {
    typeLiterals.push(t.text);
  }

  for (const typeFile of typeFiles) {
    typeLiterals.push(typeFile.content);

    if (
      typeDeclarations.some((e) =>
        e.importDeclaration?.path.startsWith(typeFile.importPath),
      )
    ) {
      if (!typeFile.routes.has(route.fileFullpath)) {
        parentPort?.postMessage({
          pool: "apiAssets",
          task: "updateTypeFiles",
          data: {
            typeFile: typeFile.file,
            addRoute: route.fileFullpath,
          },
        });
      }
    } else if (typeFile.routes.has(route.fileFullpath)) {
      parentPort?.postMessage({
        pool: "apiAssets",
        task: "updateTypeFiles",
        data: {
          typeFile: typeFile.file,
          removeRoute: route.fileFullpath,
        },
      });
    }
  }

  const sourceText = render(schemaSourceTpl, {
    typeLiterals,
    payloadTypes,
  });

  const { getZodSchemasFile, errors } = generate({
    sourceText,
    nameFilter: (id) => payloadTypes.some((e) => e.id === id || e.text === id),
    getSchemaName: (e) => e,
  });

  await generateFile(
    join(varDir, defaults.generated.api, route.importPath, "@assets.ts"),
    {
      template: assetsTpl,
      context: {
        ...route,
        typeDeclarations,
        zodSchemas: errors.length ? "" : getZodSchemasFile("index.ts"),
        payloadTypes: errors.length ? [] : payloadTypes,
        errors,
        importZodErrorHandlerFrom,
      },
    },
  );
}

function padStart(
  str: string | number,
  maxlength: number,
  fill = "0",
  decorate?: (s: string | number) => string,
): string {
  const prefixLength = maxlength - String(str).length;

  // biome-ignore format:
  const prefix = prefixLength > 0
    ? Array(prefixLength).fill(fill).join("")
    : "";

  return decorate ? prefix + decorate(str) : prefix + str;
}
