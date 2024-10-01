import { parentPort } from "node:worker_threads";
import { dirname, parse, join } from "node:path";

import fsx from "fs-extra";
import ts, { type CompilerOptions } from "typescript";
import { generate } from "ts-to-zod";
import { renderToFile } from "@appril/dev-utils";

import { defaults } from "@/base";
import { extractApiAssets, extractTypeReferences } from "@/ast";

import {
  generateAssetsFile,
  generateHashMap,
  libFilePath,
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
  appRoot,
  sourceFolder,
  importZodErrorHandlerFrom,
}: WorkerPayload) {
  console.log([route.file, "rebuilding assets"]);

  const schemaFile = libFilePath(route, "schema", { appRoot, sourceFolder });

  const generateZodSchema = async (): Promise<{
    zodSchema?: string | undefined;
    zodErrors?: Array<string> | undefined;
    discoveredTypeDeclarations?: Array<DiscoveredTypeDeclaration>;
  }> => {
    // generating schemaFile containing types required by route
    await renderToFile(schemaFile, schemaTpl, {
      typeDeclarations,
      payloadTypes,
    });

    // feeding schemaFile to Typescript api to discover all types used by route
    const discoveredTypeDeclarations = payloadTypes.length
      ? discoverTypeDeclarations()
      : [];

    // rewriting schemaFile, inserting discovered type declarations
    const sourceText = discoveredTypeDeclarations
      .flatMap((e) => (e.included ? [e.text] : []))
      .join("\n\n");

    // it is important to write sourceText to schemaFile
    // as ts-to-zod api may use it to import circular references
    fsx.writeFile(schemaFile, sourceText);

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
    const zodSchema = getZodSchemasFile(`./${parse(schemaFile).name}`);

    return { zodSchema, discoveredTypeDeclarations };
  };

  const discoverTypeDeclarations = (): Array<DiscoveredTypeDeclaration> => {
    const tsconfig = ts.getParsedCommandLineOfConfigFile(
      join(appRoot, "tsconfig.json"),
      undefined,
      ts.sys as never,
    );

    const compilerOptions: CompilerOptions = {
      declaration: true,
      emitDeclarationOnly: true,
      isolatedDeclarations: true,
      verbatimModuleSyntax: true,
      paths: tsconfig?.options?.paths,
      pathsBasePath: tsconfig?.options?.pathsBasePath,
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

    const program = ts.createProgram([schemaFile], compilerOptions, host);

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
  };

  const { typeDeclarations, middleworkerPayloadTypes } = await extractApiAssets(
    route.fileFullpath,
    {
      relpathResolver(path) {
        return join(sourceFolder, defaults.apiDir, dirname(route.file), path);
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
    await generateZodSchema();

  parentPort?.postMessage({ discoveredTypeDeclarations });

  await generateAssetsFile(route, {
    appRoot,
    sourceFolder,
    typeDeclarations,
    payloadTypes,
    importZodErrorHandlerFrom,
    zodSchema,
    zodErrors,
  });

  // generating hashmap file for comparison on next rebuild
  await fsx.writeJson(
    libFilePath(route, "hashmap", { appRoot, sourceFolder }),
    await generateHashMap(
      route,
      // even if zod schema generation failed, writing an empty hashmap file
      // to be sure next rebuild will run regardless
      discoveredTypeDeclarations?.map((e) => e.file) || [],
      { appRoot, sourceFolder },
    ),
  );

  process.exit(0);
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
