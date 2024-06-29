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
let importZodErrorHandlerFrom: string | undefined;

export async function bootstrap(data: {
  routes: ApiRoute[];
  sourceFolder: string;
  typeFiles: TypeFile[];
  importZodErrorHandlerFrom?: string;
}) {
  const { routes, typeFiles } = data;

  sourceFolder = data.sourceFolder;
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
        return join(sourceFolder, defaults.apiDir, dirname(route.file), path);
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

  const generateAssetsFile = (data?: {
    zodSchemas?: string | undefined;
    errors?: Array<string>;
  }) => {
    return generateFile(
      join(defaults.varDir, defaults.apiDir, route.importPath, "@assets.ts"),
      {
        template: assetsTpl,
        context: {
          ...route,
          ...data,
          typeDeclarations,
          payloadTypes,
          importZodErrorHandlerFrom,
        },
      },
    );
  };

  // generating zod schemas may take some time
  // so generating a generic assets file
  // then re-generating it when zod schemas ready
  await generateAssetsFile();

  try {
    const { getZodSchemasFile, errors } = generate({
      sourceText,
      nameFilter: (id) =>
        payloadTypes.some((e) => e.id === id || e.text === id),
      getSchemaName: (e) => e,
    });
    await generateAssetsFile({
      zodSchemas: errors.length ? "" : getZodSchemasFile("index.ts"),
      errors,
    });
  } catch (error) {
    console.error(
      `\n[ \x1b[31m${route.file}\x1b[0m ]: failed building zod schema(s)`,
    );
    console.log(error);
  }
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
