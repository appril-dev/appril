import { resolve, basename } from "node:path";

import fsx from "fs-extra";
import merge from "merge";

export async function mergePackageJson(
  src: string,
  dst: string,
): Promise<void> {
  const srcFile = resolve(src, "package.json");
  const dstFile = resolve(dst, "package.json");

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
  { exclude = [] }: { exclude?: string[] } = {},
): Promise<void> {
  const filter = exclude.length
    ? (path: string) => !exclude.includes(basename(path))
    : null;

  await fsx.copy(src, dst, {
    ...(filter ? { filter } : {}),
  });
}
