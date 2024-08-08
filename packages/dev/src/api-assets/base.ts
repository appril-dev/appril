import { join } from "node:path";

import { renderToFile } from "@appril/dev-utils";
import crc32 from "crc/crc32";
import fsx from "fs-extra";

import type { TypeDeclaration } from "../ast";

import assetsTpl from "./templates/assets.hbs";

export type DerivedRoute = import("../@types").ApiRoute & {
  appDir: string;
  srcDir: string;
  varDir: string;
  hashmapFile: string;
  schemaFile: string;
  assetsFile: string;
};

export type PayloadType = {
  id: string;
  index: string;
  text: string;
};

export type WorkerPayload = {
  route: DerivedRoute;
  sourceFolder: string;
  importZodErrorHandlerFrom: string | undefined;
};

export type HashMap = {
  file: string;
  hash: number;
  deps: Record<string, number>;
};

export type DiscoveredTypeDeclaration = {
  file: string;
  name: string;
  text: string;
  typeReferences: Array<string>;
  included?: boolean;
};

export function generateAssetsFile(
  route: DerivedRoute,
  {
    typeDeclarations,
    payloadTypes,
    zodSchema,
    zodErrors,
    importZodErrorHandlerFrom,
    overwrite = true,
  }: {
    typeDeclarations: Array<TypeDeclaration>;
    payloadTypes: Array<PayloadType>;
    zodSchema?: string | undefined;
    zodErrors?: Array<string>;
    importZodErrorHandlerFrom: string | undefined;
    overwrite?: boolean;
  },
) {
  return renderToFile(
    route.assetsFile,
    assetsTpl,
    {
      route,
      typeDeclarations,
      payloadTypes,
      zodSchema,
      zodErrors,
      importZodErrorHandlerFrom,
    },
    { overwrite },
  );
}

async function generateHashSum(file: string): Promise<number> {
  let fileContent: string | undefined;
  try {
    fileContent = await fsx.readFile(file, "utf8");
  } catch (e) {
    // file could be deleted since last build
    return 0;
  }
  return fileContent ? crc32(fileContent) : 0;
}

// computing hash for route and all it's deps.
// when some hash changed, rebuild route
export async function generateHashMap(
  route: DerivedRoute,
  _deps: Array<string>,
): Promise<HashMap> {
  const deps: HashMap["deps"] = {};

  for (const file of new Set(_deps)) {
    if (!file.startsWith(route.varDir)) {
      deps[
        // dropping root in case hashmap used in CI environment / another OS
        file.replace(`${route.appDir}/`, "")
      ] = await generateHashSum(file);
    }
  }

  return {
    file: route.file,
    hash: await generateHashSum(route.fileFullpath),
    deps,
  };
}

// returns false if some file changed
export async function identicalHashMap(route: DerivedRoute, hashmap: HashMap) {
  if (
    !identicalHashSum(hashmap.hash, await generateHashSum(route.fileFullpath))
  ) {
    // route itself updated, signaling rebuild without checking deps
    return false;
  }

  for (const [path, sum] of Object.entries(hashmap.deps)) {
    // prepending root as it was removed by generateHashSum
    const file = join(route.appDir, path);
    if (!identicalHashSum(sum, await generateHashSum(file))) {
      return false;
    }
  }

  return true;
}

export function extractDepFiles(route: DerivedRoute, hashmap: HashMap) {
  return Object.keys(hashmap.deps || {}).map((e) => {
    // restoring root dropped by generateHashMap
    return join(route.appDir, e);
  });
}

// return true if sums are identical
function identicalHashSum(a: number, b: number) {
  return a === b;
}
