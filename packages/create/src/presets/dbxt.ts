import { resolve } from "node:path";
import { readFile, appendFile } from "node:fs/promises";

import { mergePackageJson, copyFiles } from "@/base";

export default async function dbxtPreset(
  root: string,
  dst: string,
): Promise<void> {
  const src = resolve(root, "dbxt");

  await copyFiles(src, dst, {
    exclude: [".env", "package.json"],
  });

  const env = await readFile(resolve(src, ".env"), "utf8");

  await appendFile(resolve(dst, ".env"), env);
  await appendFile(resolve(dst, ".env.schema"), env);

  await mergePackageJson(src, dst);
}
