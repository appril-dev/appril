import { join, resolve } from "node:path";

import { mergePackageJson, copyFiles } from "../helpers";

export default async function solidPreset(
  root: string,
  dst: string,
  sourceFolder: string,
): Promise<void> {
  const src = resolve(root);

  await copyFiles(join(src, "root"), dst, {
    exclude: ["package.json"],
  });

  await mergePackageJson(join(src, "root"), dst);

  await copyFiles(join(src, "src"), join(dst, sourceFolder), {
    exclude: ["config.ts"],
  });
}
