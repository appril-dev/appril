import { resolve, join } from "node:path";

import { mergeJsonFiles, copyFiles } from "@/base";

export default async (root: string, dst: string): Promise<void> => {
  const src = resolve(root, "pgxt");

  await copyFiles(src, dst, {
    exclude: ["package.json"],
  });

  await mergeJsonFiles(join(src, "package.json"), join(dst, "package.json"));
};
