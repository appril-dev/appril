import { resolve } from "node:path";

import type { ResolvedConfig } from "vite";
import fsx from "fs-extra";
import glob from "fast-glob";
import { fileGenerator } from "@appril/dev-utils";

import { BANNER } from "@/base";

type ContextFolder = {
  folder: string;
  files: Array<ResolvedFile>;
};

type Context = {
  files: Array<ResolvedFile>;
  folders: Array<ContextFolder>;
};

type ContextHandler = (data: Context) => unknown;

type Entry = {
  base: string;
  folders?: Array<string>;
  pattern?: string | Array<string>;
  ignore?: string | Array<string>;
  defaultIgnore?: string | Array<string>;
  template: string;
  outfile: string;
  context?: ContextHandler;
};

type ResolvedFile = {
  name: string;
  basename: string;
  path: string;
  relativePath: string;
  folder: string;
  importName: string;
  importPath: string;
  content: string;
};

const PLUGIN_NAME = "@appril:fileBundlerPlugin";

export function fileBundlerPlugin(
  entries: Array<Entry>,
): import("vite").Plugin {
  async function resolveFiles(
    root: string,
    entry: Required<Entry>,
  ): Promise<Array<ResolvedFile>> {
    const files: Array<ResolvedFile> = [];

    const patterns = Array.isArray(entry.pattern)
      ? entry.pattern
      : [entry.pattern];

    const { folders } = entry;

    const patternMapper = (p: string) => {
      return folders.length
        ? folders.map((f) => resolve(root, entry.base, f, p))
        : [resolve(root, entry.base, p)];
    };

    const cwd = resolve(root, entry.base);

    const matches = await glob(patterns.flatMap(patternMapper), {
      cwd,
      onlyFiles: true,
      objectMode: true,
      ignore: [
        ...(Array.isArray(entry.ignore)
          ? entry.ignore
          : entry.ignore
            ? [entry.ignore]
            : []),
        ...(Array.isArray(entry.defaultIgnore)
          ? entry.defaultIgnore
          : entry.defaultIgnore
            ? [entry.defaultIgnore]
            : []),
      ],
    });

    for (const match of matches) {
      if (match.path === resolve(root, entry.outfile)) {
        continue;
      }

      const relativePath = match.path.replace(`${cwd}/`, "");

      const name = relativePath.replace(/\.([^.]+)$/, "");

      // biome-ignore format:
      const folder = entry.folders.find(
        (f) => new RegExp(`^${f}/`).test(name)
      ) || "";

      const content = await fsx.readFile(match.path, "utf8");

      files.push({
        name,
        basename: folder ? name.replace(new RegExp(`^${folder}/`), "") : name,
        path: match.path,
        relativePath,
        folder,
        importName: `$${name.replace(/[^\w]/g, "_")}`,
        importPath: `./${name}`,
        content,
      });
    }

    return files.sort((a, b) => a.name.localeCompare(b.name));
  }

  async function generateFiles({ root }: ResolvedConfig) {
    const { generateFile } = fileGenerator(root);

    for (const _entry of entries) {
      const entry: Required<Entry> = {
        pattern: "**/*.ts",
        folders: [],
        ignore: [],
        defaultIgnore: ["**/_*", "**/@*"],
        context: (data) => data,
        ..._entry,
      };

      const files = await resolveFiles(root, entry);

      const template = await fsx.readFile(
        resolve(root, entry.template),
        "utf8",
      );

      const folderMapper = (folder: string) => ({
        folder,
        files: files.filter((f) => f.folder === folder),
      });

      const context = entry.context({
        files,
        folders: entry.folders.map(folderMapper),
      });

      await generateFile(entry.outfile, {
        template,
        context: {
          BANNER,
          ...(context || {}),
        },
      });
    }
  }

  return {
    name: PLUGIN_NAME,
    configResolved: generateFiles,
  };
}
