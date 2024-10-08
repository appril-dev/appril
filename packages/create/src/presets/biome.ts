import { join, resolve } from "node:path";

import { defaults } from "@appril/configs";
import { renderToFile } from "@appril/dev-utils";

import { mergeJsonFiles, type Context } from "@/base";

import biomeTpl from "./biome/biome.hbs";

export default async (
  root: string,
  dst: string,
  ctx: Context,
): Promise<void> => {
  const src = resolve(root, "biome");

  await renderToFile(join(dst, "biome.json"), biomeTpl, { ...ctx, defaults });

  await mergeJsonFiles(join(src, "package.json"), join(dst, "package.json"));
};
