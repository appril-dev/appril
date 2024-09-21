import { resolve, join } from "node:path";
import { readFile, appendFile } from "node:fs/promises";

import { mergeJsonFiles, copyFiles } from "@/base";

export default async (root: string, dst: string): Promise<void> => {
  const src = resolve(root, "dbxt");

  await copyFiles(src, dst, {
    exclude: [".env", "package.json"],
  });

  const env = await readFile(resolve(src, ".env"), "utf8");

  await appendFile(resolve(dst, ".env"), env);
  await appendFile(resolve(dst, ".env.schema"), env);

  await mergeJsonFiles(join(src, "package.json"), join(dst, "package.json"));
};
