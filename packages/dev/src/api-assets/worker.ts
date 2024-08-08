import { parentPort } from "node:worker_threads";
import { dirname, parse, join } from "node:path";

import fsx from "fs-extra";
import ts, { type CompilerOptions } from "typescript";
import { generate } from "ts-to-zod";
import { renderToFile } from "@appril/dev-utils";

import { defaults } from "../defaults";

import {
  extractApiAssets,
  extractTypeReferences,
  type TypeDeclaration,
} from "../ast";

import {
  generateAssetsFile,
  generateHashMap,
  type DerivedRoute,
  type DiscoveredTypeDeclaration,
  type PayloadType,
  type WorkerPayload,
} from "./base";

import schemaTpl from "./templates/schema.hbs";

parentPort?.on("message", worker);

process.on("uncaughtException", (error) => {
  console.error("UncaughtException", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("UnhandledRejection", promise, reason);
  process.exit(1);
});

async function worker({
  route,
  sourceFolder,
  importZodErrorHandlerFrom,
}: WorkerPayload) {
  console.log([route.file, "rebuilding assets"]);
  const { typeDeclarations, middleworkerPayloadTypes } = await extractApiAssets(
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

  const payloadTypes = Object.entries(middleworkerPayloadTypes).map(
    ([index, { method, payloadType }]): PayloadType => {
      return {
        id: `PayloadValidation$${method.toUpperCase() + padStart(index, 3)}`,
        index,
        text: payloadType,
      };
    },
  );

  const { zodSchema, zodErrors, discoveredTypeDeclarations } =
    await generateZodSchema(route, { typeDeclarations, payloadTypes });

  parentPort?.postMessage({ discoveredTypeDeclarations });

  await generateAssetsFile(route, {
    typeDeclarations,
    payloadTypes,
    importZodErrorHandlerFrom,
    zodSchema,
    zodErrors,
  });

  // generating hashmap file for comparison on next rebuild
  await fsx.writeJson(
    route.hashmapFile,
    await generateHashMap(
      route,
      // even if zod schema generation failed, writing an empty hashmap file
      // to be sure next rebuild will run regardless
      discoveredTypeDeclarations?.map((e) => e.file) || [],
    ),
  );

  process.exit(0);
}

async function generateZodSchema(
  route: DerivedRoute,
  {
    typeDeclarations,
    payloadTypes,
  }: {
    typeDeclarations: Array<TypeDeclaration>;
    payloadTypes: Array<PayloadType>;
  },
): Promise<{
  zodSchema?: string | undefined;
  zodErrors?: Array<string> | undefined;
  discoveredTypeDeclarations?: Array<DiscoveredTypeDeclaration>;
}> {
  // generating schemaFile containing types required by route
  await renderToFile(route.schemaFile, schemaTpl, {
    typeDeclarations,
    payloadTypes,
  });

  // feeding schemaFile to Typescript api to discover all types used by route
  const discoveredTypeDeclarations = payloadTypes.length
    ? discoverTypeDeclarations(route, payloadTypes)
    : [];

  // rewriting schemaFile, inserting discovered type declarations
  const sourceText = discoveredTypeDeclarations
    .flatMap((e) => (e.included ? [e.text] : []))
    .join("\n\n");

  // it is important to write sourceText to schemaFile
  // as ts-to-zod api may use it to import circular references
  fsx.writeFile(route.schemaFile, sourceText);

  // feeding schemaFile content to ts-to-zod api to get zod schema
  const { getZodSchemasFile, errors: zodErrors } = generate({
    sourceText,
    keepComments: true,
    getSchemaName: (e) => `${e}Schema`,
  });

  if (zodErrors.length) {
    return { zodErrors };
  }

  // providing relative path to schemaFile
  // as ts-to-zod api may use it to import circular references
  const zodSchema = getZodSchemasFile(`./${parse(route.schemaFile).name}`);

  return { zodSchema, discoveredTypeDeclarations };
}

function discoverTypeDeclarations(
  route: DerivedRoute,
  payloadTypes: Array<PayloadType>,
): Array<DiscoveredTypeDeclaration> {
  const compilerOptions: CompilerOptions = {
    declaration: true,
    emitDeclarationOnly: true,
    isolatedDeclarations: true,
    verbatimModuleSyntax: true,
    paths: {
      [`${defaults.appPrefix}/*`]: [`${route.appDir}/*`],
      [`${defaults.srcPrefix}/*`]: [`${route.srcDir}/*`],
      [`${defaults.varPrefix}/*`]: [
        `${route.srcDir}/${defaults.varDir}/*`,
        `${route.appDir}/${defaults.varDir}/*`,
      ],
    },
  };

  const discoveredTypeDeclarations: Array<DiscoveredTypeDeclaration> = [];

  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const host = ts.createCompilerHost(compilerOptions);

  host.writeFile = (
    _fileName,
    _text,
    _writeByteOrderMark,
    _onError,
    sourceFiles,
  ) => {
    for (const sourceFile of sourceFiles || []) {
      ts.forEachChild(sourceFile, (node) => {
        if (ts.isTypeAliasDeclaration(node)) {
          const name = node.name.text;
          if (!discoveredTypeDeclarations.some((e) => e.name === name)) {
            discoveredTypeDeclarations.unshift({
              file: sourceFile.fileName,
              name,
              text: printer.printNode(
                ts.EmitHint.Unspecified,
                node,
                sourceFile,
              ),
              typeReferences: extractTypeReferences(node),
            });
          }
        }
      });
    }
  };

  const program = ts.createProgram([route.schemaFile], compilerOptions, host);

  program.emit();

  for (const typeAlias of discoveredTypeDeclarations) {
    const nameRegex = new RegExp(`\\b${typeAlias.name}\\b`);
    typeAlias.included =
      payloadTypes.some((e) => {
        // included if required by payloadTypes
        return e.id === typeAlias.name || e.text.match(nameRegex);
      }) ||
      discoveredTypeDeclarations.some((e) => {
        // included if required by another included types
        return e.included ? e.typeReferences.includes(typeAlias.name) : false;
      });
  }

  return discoveredTypeDeclarations;
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
