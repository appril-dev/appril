import { resolve } from "node:path";

import { mergePackageJson, copyFiles } from "@/base";

export default async (root: string, dst: string): Promise<void> => {
  const src = resolve(root, "pgxt");

  await copyFiles(src, dst, {
    exclude: ["package.json"],
  });

  await mergePackageJson(src, dst);
};
