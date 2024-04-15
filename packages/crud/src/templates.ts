import { readFile, readdir } from "node:fs/promises";
import { join, resolve, basename } from "node:path";

import type { DefaultTemplates } from "./@types";

export async function readTemplates(): Promise<DefaultTemplates> {
  const root = resolve(import.meta.dirname, "templates");

  const entries = await readdir(root, {
    withFileTypes: true,
    recursive: true,
  });

  const files = entries.filter((e) => e.isFile()).sort(sortTemplates);

  const templateMap: Record<
    string,
    Record<string, { file: string; content: string }>
  > = {
    api: {},
    client: {},
  };

  for (const file of files) {
    const base = basename(file.path.replace(root, ""));
    const name = file.name.replace(/\.hbs$/, "");

    if (base in templateMap) {
      templateMap[base][name] = {
        file: join(file.path, file.name),
        content: await readFile(join(file.path, file.name), "utf8"),
      };
    }
  }

  return templateMap as DefaultTemplates;
}

export function sortTemplates(a: { name: string }, b: { name: string }) {
  // sorting to place .hbs files at the end
  // to make sure they would override .ts ones
  const atpl = a.name.includes(".hbs");
  const btpl = b.name.includes(".hbs");
  if (atpl && btpl) {
    return 0;
  }
  if (atpl) {
    return 1;
  }
  if (btpl) {
    return -1;
  }
  return 0;
}
