import { parentPort } from "node:worker_threads";
import { dirname, parse, join } from "node:path";

import fsx from "fs-extra";
import ts from "typescript";
import crc32 from "crc/crc32";
import { generate } from "ts-to-zod";

import { render, renderToFile } from "@appril/dev-utils";

import { defaults } from "@/base";
import { extractApiAssets, extractTypeReferences } from "@/ast";

import {
  generateRulesFile,
  generateHashMap,
  libFilePath,
  type DiscoveredTypeDeclaration,
  type PayloadType,
  type WorkerPayload,
} from "./base";

import schemaTsTpl from "./templates/schema-ts.hbs";
import schemaZodTpl from "./templates/schema-zod.hbs";

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

  const generateZodSchema = async (): Promise<{
    zodSchema?: string | undefined;
    zodErrors?: Array<string> | undefined;
    discoveredTypeDeclarations?: Array<DiscoveredTypeDeclaration>;
  }> => {
    const schemaFile = libFilePath(route, "schema", { appRoot, sourceFolder });

    // writing extracted types to schemaFile
    await renderToFile(schemaFile, schemaTsTpl, {
      typeDeclarations,
      payloadTypes,
    });

    // and feeding it to Typescript api to discover all types used by route
    const discoveredTypeDeclarations =
      paramsType || payloadTypes.length
        ? discoverTypeDeclarations(schemaFile)
        : [];

    // then rewriting schemaFile. it should contain all relevant type literals
    const sourceText = render(schemaZodTpl, {
      discoveredTypeDeclarations,
      paramsType: { ...route.params, customSchema: paramsType },
    });

    await fsx.writeFile(schemaFile, sourceText);

    // and feeding it to ts-to-zod api to get zod schema
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

  const discoverTypeDeclarations = (
    schemaFile: string,
  ): Array<DiscoveredTypeDeclaration> => {
    const tsconfig = ts.getParsedCommandLineOfConfigFile(
      join(appRoot, "tsconfig.json"),
      undefined,
      ts.sys as never,
    );

    const compilerOptions: ts.CompilerOptions = {
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
      typeAlias.included = [
        // included if required by paramsType
        paramsType ? nameRegex.test(paramsType) : false,
        // or required by payloadTypes
        payloadTypes.some((e) => {
          return e.id === typeAlias.name || e.text.match(nameRegex);
        }),
        // or required by another included types
        discoveredTypeDeclarations.some((e) => {
          return e.included ? e.typeReferences.includes(typeAlias.name) : false;
        }),
      ].some((e) => e);
    }

    return discoveredTypeDeclarations;
  };

  const apiAssets = await extractApiAssets({
    file: route.fileFullpath,
    relpathResolver(path) {
      return join(sourceFolder, defaults.apiDir, dirname(route.file), path);
    },
  });

  const { typeDeclarations, paramsType } = apiAssets;

  const payloadTypes = Object.entries(apiAssets.payloadTypes).map(
    ([method, text]: [m: string, t: string]): PayloadType => {
      return {
        id: ["PayloadT", crc32(route.importName + method)].join(""),
        method,
        text,
      };
    },
  );

  const { zodSchema, zodErrors, discoveredTypeDeclarations } =
    await generateZodSchema();

  parentPort?.postMessage({ discoveredTypeDeclarations });

  await generateRulesFile(route, {
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
      discoveredTypeDeclarations
        ? discoveredTypeDeclarations.flatMap((e) => {
            return e.included ? [e.file] : [];
          })
        : [],
      { appRoot, sourceFolder },
    ),
  );

  process.exit(0);
}
