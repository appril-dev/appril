import { join } from "node:path";

import { renderToFile } from "@appril/dev-utils";
import crc32 from "crc/crc32";
import fsx from "fs-extra";

import { type ApiRoute, defaults } from "@/base";
import type { TypeDeclaration } from "@/ast";

import assetsTpl from "./templates/assets.hbs";

export type PayloadType = {
  id: string;
  index: string;
  text: string;
};

export type WorkerPayload = {
  route: ApiRoute;
  appRoot: string;
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

export function varFileBase(
  route: ApiRoute,
  { appRoot, sourceFolder }: { appRoot: string; sourceFolder: string },
) {
  return join(
    appRoot,
    defaults.varDir,
    sourceFolder,
    defaults.varApiDir,
    route.importPath,
  );
}

export function varFilePath(
  route: ApiRoute,
  file: "assets" | "schema" | "hashmap",
  { appRoot, sourceFolder }: { appRoot: string; sourceFolder: string },
) {
  return join(
    varFileBase(route, { appRoot, sourceFolder }),
    { assets: "@assets.ts", schema: "@schema.ts", hashmap: "@hashmap.json" }[
      file
    ],
  );
}

export function generateAssetsFile(
  route: ApiRoute,
  {
    appRoot,
    sourceFolder,
    typeDeclarations,
    payloadTypes,
    zodSchema,
    zodErrors,
    importZodErrorHandlerFrom,
    overwrite = true,
  }: {
    appRoot: string;
    sourceFolder: string;
    typeDeclarations: Array<TypeDeclaration>;
    payloadTypes: Array<PayloadType>;
    zodSchema?: string | undefined;
    zodErrors?: Array<string>;
    importZodErrorHandlerFrom: string | undefined;
    overwrite?: boolean;
  },
) {
  return renderToFile(
    varFilePath(route, "assets", { appRoot, sourceFolder }),
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
  route: ApiRoute,
  _deps: Array<string>,
  {
    appRoot,
    sourceFolder,
  }: {
    appRoot: string;
    sourceFolder: string;
  },
): Promise<HashMap> {
  const deps: HashMap["deps"] = {};

  for (const file of new Set(_deps)) {
    const varDir = varFileBase(route, { appRoot, sourceFolder });
    if (!file.startsWith(varDir)) {
      deps[
        // dropping root in case hashmap used in CI environment / another OS
        file.replace(`${appRoot}/`, "")
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
export async function identicalHashMap(
  route: ApiRoute,
  hashmap: HashMap,
  { appRoot }: { appRoot: string },
) {
  if (
    !identicalHashSum(hashmap.hash, await generateHashSum(route.fileFullpath))
  ) {
    // route itself updated, signaling rebuild without checking deps
    return false;
  }

  for (const [path, sum] of Object.entries(hashmap.deps)) {
    // prepending root as it was removed by generateHashSum
    if (!identicalHashSum(sum, await generateHashSum(join(appRoot, path)))) {
      return false;
    }
  }

  return true;
}

export function extractDepFiles(
  _route: ApiRoute,
  hashmap: HashMap,
  { appRoot }: { appRoot: string },
) {
  return Object.keys(hashmap.deps || {}).map((e) => {
    // restoring root dropped by generateHashMap
    return join(appRoot, e);
  });
}

// return true if sums are identical
function identicalHashSum(a: number, b: number) {
  return a === b;
}
