import { parentPort } from "node:worker_threads";
import { dirname, parse, join } from "node:path";

import fsx from "fs-extra";
import { Project, type SourceFile, SyntaxKind } from "ts-morph";
import { generate } from "ts-to-zod";
import { render, renderToFile } from "@appril/dev-utils";

import { defaults } from "@/base";
import { extractApiAssets } from "@/ast";

import {
  generateRulesFile,
  generateHashMap,
  libFilePath,
  type DiscoveredTypeDeclaration,
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
  traverseMaxDepth,
  importZodErrorHandlerFrom,
}: WorkerPayload) {
  console.log([route.file, "rebuilding assets"]);

  const discoverTypeDeclarations = (): Array<DiscoveredTypeDeclaration> => {
    const project = new Project({
      tsConfigFilePath: join(appRoot, "tsconfig.json"),
      skipAddingFilesFromTsConfig: true,
    });

    const compilerOptions = project.getCompilerOptions();

    if (!compilerOptions?.paths) {
      process.exit(1);
    }

    const prefixes = [
      /^\./,
      Object.keys(compilerOptions.paths).map(
        (e) => new RegExp(`^${e.replace("*", "")}`),
      ),
    ].flat();

    const sourceFile = project.addSourceFileAtPath(schemaFile);

    const sourceFiles: Array<[string, SourceFile, number]> = [
      [schemaFile, sourceFile, 0],
    ];

    const traverseSourceFiles = (sourceFile: SourceFile, depth = 0) => {
      if (depth > traverseMaxDepth) {
        return;
      }

      for (const declaration of [
        sourceFile.getImportDeclarations(),
        sourceFile.getExportDeclarations(),
      ].flat()) {
        const modulePath = declaration.getModuleSpecifierValue();

        if (!modulePath || !prefixes.some((e) => e.test(modulePath))) {
          continue;
        }

        const file = declaration.getModuleSpecifierSourceFile();

        if (!file) {
          continue;
        }

        const path = file.getFilePath();

        if (sourceFiles.some(([p]) => p === path)) {
          continue;
        }

        sourceFiles.push([path, file, depth]);

        traverseSourceFiles(file, depth + 1);
      }
    };

    traverseSourceFiles(sourceFile);

    const discoveredTypeDeclarations: Array<DiscoveredTypeDeclaration> = [];

    for (const [path, file] of sourceFiles) {
      for (const node of [
        file.getTypeAliases().filter((e) => {
          const kind = e.getTypeNode()?.getKind();
          return kind
            ? [
                SyntaxKind.TypeLiteral,
                SyntaxKind.TypeReference,
                SyntaxKind.UnionType,
              ].includes(kind)
            : false;
        }),
        file.getEnums(),
      ].flat()) {
        const name = node.getName();
        const nameRegex = new RegExp(`\\b${name}\\b`);
        if (discoveredTypeDeclarations.some((e) => e.name === name)) {
          continue;
        }
        discoveredTypeDeclarations.push({
          file: path,
          name,
          nameRegex,
          text: node.getText(),
          included: [
            // included if referenced in paramsType
            paramsType ? nameRegex.test(paramsType) : false,
            // or referenced in payloadTypes
            payloadTypes.some((e) => e.id === name || e.text.match(nameRegex)),
            // or referenced in returnTypes
            returnTypes.some((e) => e.id === name || e.text.match(nameRegex)),
          ].some((e) => e),
        });
      }
    }

    const [included, excluded] = discoveredTypeDeclarations.reduce(
      (
        a: [Array<DiscoveredTypeDeclaration>, Array<DiscoveredTypeDeclaration>],
        e,
      ) => {
        a[e.included ? 0 : 1].push(e);
        return a;
      },
      [[], []],
    );

    // including types not directly required by params/payload
    // but used by those types
    for (const typeAlias of excluded) {
      if (included.some((e) => e.text.match(typeAlias.nameRegex))) {
        typeAlias.included = true;
      }
    }

    return discoveredTypeDeclarations;
  };

  const generateZodSchemas = async (): Promise<{
    zodSchema?: string | undefined;
    zodErrors?: Array<string> | undefined;
  }> => {
    // and feeding it to ts-to-zod api to get zod schema
    const { getZodSchemasFile, errors: zodErrors } = generate({
      sourceText: typeLiterals,
      keepComments: true,
      getSchemaName: (e) => `${e}Schema`,
    });

    if (zodErrors.length) {
      return { zodErrors };
    }

    // providing relative path to schemaFile
    // as ts-to-zod api may use it to import circular references
    const zodSchema = getZodSchemasFile(`./${parse(schemaFile).name}`);

    return { zodSchema };
  };

  const { typeDeclarations, paramsType, routeSpecSignatures } =
    await extractApiAssets({
      route,
      relpathResolver(path) {
        return join(sourceFolder, defaults.apiDir, dirname(route.file), path);
      },
    });

  const payloadTypes = routeSpecSignatures.flatMap((e) =>
    e.payloadType ? [e.payloadType] : [],
  );

  const returnTypes = routeSpecSignatures.flatMap((e) =>
    e.returnType ? [e.returnType] : [],
  );

  const schemaFile = libFilePath(route, "schema", { appRoot, sourceFolder });

  await renderToFile(schemaFile, schemaTsTpl, {
    typeDeclarations,
    payloadTypes,
    returnTypes,
  });

  const discoveredTypeDeclarations =
    paramsType || payloadTypes.length || returnTypes.length
      ? discoverTypeDeclarations()
      : [];

  const typeLiterals = render(schemaZodTpl, {
    discoveredTypeDeclarations,
    paramsType: { ...route.params, customSchema: paramsType },
  });

  await fsx.writeFile(schemaFile, typeLiterals);

  const { zodSchema, zodErrors } = await generateZodSchemas();

  await generateRulesFile(route, {
    appRoot,
    sourceFolder,
    typeDeclarations,
    payloadTypes,
    returnTypes,
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
      discoveredTypeDeclarations.flatMap((e) => {
        return e.included ? [e.file] : [];
      }),
      { appRoot, sourceFolder },
    ),
  );

  parentPort?.postMessage({ discoveredTypeDeclarations });

  process.nextTick(() => process.exit(0));
}
