import { resolve, basename } from "node:path";

import fsx from "fs-extra";
import merge from "merge";
import type { Answers } from "prompts";

export type Questions =
  | "name"
  | "framework"
  | "srcFolders"
  | "distDir"
  | "devPort"
  | "presets";

export type Context = {
  project: Answers<Questions>;
  solidFramework: boolean;
  // coming from esbuild (define option)
  NODE_VERSION: string;
  ESBUILD_TARGET: string;
  PACKAGE_MANAGER: string;
};

export async function mergeJsonFiles(
  srcFile: string,
  dstFile: string,
): Promise<void> {
  const json = merge.recursive(
    JSON.parse(await fsx.readFile(dstFile, "utf8")),
    JSON.parse(await fsx.readFile(srcFile, "utf8")),
  );
  await fsx.writeJson(dstFile, json, {
    spaces: 2,
  });
}

export async function copyFiles(
  src: string,
  dst: string,
  { exclude = [] }: { exclude?: Array<string | RegExp> } = {},
): Promise<void> {
  const filter = exclude.length
    ? (path: string) => {
        return !exclude.some((e) => {
          return typeof e === "string" ? e === basename(path) : e.test(path);
        });
      }
    : undefined;

  await fsx.copy(src, dst, {
    filter,
  });
}
