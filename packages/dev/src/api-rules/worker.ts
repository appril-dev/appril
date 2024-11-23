import { parentPort } from "node:worker_threads";
import { dirname, parse, join } from "node:path";

import fsx from "fs-extra";
import { generate } from "ts-to-zod";
import { renderToFile } from "@appril/dev-utils";

import { defaults } from "@/base";
import {
  discoverTypeDeclarations,
  extractApiAssets,
  type DiscoveredTypeDeclaration,
} from "@/ast";

import {
  type WorkerPayload,
  generateRulesFile,
  generateHashMap,
  libFilePath,
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

const generateZodSchemas = async (
  schemaFile: string,
  sourceText: string,
): Promise<{
  zodSchema?: string | undefined;
  zodErrors?: Array<string> | undefined;
}> => {
  const { getZodSchemasFile, errors: zodErrors } = generate({
    sourceText,
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

async function worker({
  route,
  appRoot,
  sourceFolder,
  traverseMaxDepth,
  importZodErrorHandlerFrom,
}: WorkerPayload) {
  console.log([route.file, "rebuilding assets"]);

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

  await renderToFile(schemaFile, schemaTpl, {
    typeDeclarations,
    paramsType: { ...route.params, customSchema: paramsType },
    payloadTypes,
    responseTypes,
  });

  const discoveredTypeDeclarations: Array<
    DiscoveredTypeDeclaration & { included?: boolean }
  > = discoverTypeDeclarations(schemaFile, {
    tsconfigFile: join(appRoot, "tsconfig.json"),
    traverseMaxDepth,
  });

  for (const t of discoveredTypeDeclarations) {
    if (t.parameters?.length) {
      // ts-to-zod does not support generics
      continue;
    }
    t.included = [
      route.params.id === t.name,
      paramsType ? t.nameRegex.test(paramsType) : false,
      payloadTypes.some((e) => e.id === t.name || t.nameRegex.test(e.text)),
      responseTypes.some((e) => e.id === t.name || t.nameRegex.test(e.text)),
    ].some((e) => e === true);
  }

  // including types that was not explicitly referenced
  // but are required by referenced types
  for (const candidate of discoveredTypeDeclarations) {
    if (candidate.included) {
      continue;
    }
    // filtering on every iteration to pick ones that was included after iteration started
    candidate.included = discoveredTypeDeclarations.some((e) => {
      return e.included
        ? e.referencedTypes?.includes(candidate.name) ||
            e.referencedTypesRecursive?.includes(candidate.name)
        : false;
    });
  }

  const referencedTypeDeclarations = discoveredTypeDeclarations.filter(
    (e) => e.included,
  );

  const typeLiterals = referencedTypeDeclarations.map((e) => e.text).join("\n");

  await fsx.writeFile(schemaFile, typeLiterals);

  const { zodSchema, zodErrors } = await generateZodSchemas(
    schemaFile,
    typeLiterals,
  );

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
      referencedTypeDeclarations.map((e) => e.file),
      { appRoot, sourceFolder },
    ),
    { spaces: 2 },
  );

  parentPort?.postMessage({ referencedTypeDeclarations });

  process.nextTick(() => process.exit(0));
}
