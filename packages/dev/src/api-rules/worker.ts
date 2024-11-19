import { parentPort } from "node:worker_threads";
import { dirname, parse, join } from "node:path";

import fsx from "fs-extra";
import { generate } from "ts-to-zod";
import { render, renderToFile } from "@appril/dev-utils";

import { defaults } from "@/base";
import { discoverTypeDeclarations, extractApiAssets } from "@/ast";

import {
  generateRulesFile,
  generateHashMap,
  libFilePath,
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

    // providing relative path to schemaFile,
    // ts-to-zod may use it to import circular references
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

  const payloadTypes = routeSpecSignatures.flatMap((e) => {
    return e.payloadType ? [e.payloadType] : [];
  });

  const responseTypes = routeSpecSignatures.flatMap((e) => {
    return e.responseType ? [e.responseType] : [];
  });

  const schemaFile = libFilePath(route, "schema", { appRoot, sourceFolder });

  await renderToFile(schemaFile, schemaTsTpl, {
    typeDeclarations,
  });

  const discoveredTypeDeclarations =
    paramsType || payloadTypes.length || responseTypes.length
      ? discoverTypeDeclarations(schemaFile, {
          tsconfigFile: join(appRoot, "tsconfig.json"),
          traverseMaxDepth,
        })
      : [];

  const typeLiterals = render(schemaZodTpl, {
    discoveredTypeDeclarations,
    paramsType: { ...route.params, customSchema: paramsType },
    payloadTypes,
    responseTypes,
  });

  await fsx.writeFile(schemaFile, typeLiterals);

  const { zodSchema, zodErrors } = await generateZodSchemas();

  await generateRulesFile(route, {
    appRoot,
    sourceFolder,
    typeDeclarations,
    payloadTypes,
    responseTypes,
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
      discoveredTypeDeclarations.map((e) => e.file),
      { appRoot, sourceFolder },
    ),
    { spaces: 2 },
  );

  parentPort?.postMessage({ discoveredTypeDeclarations });

  process.nextTick(() => process.exit(0));
}
