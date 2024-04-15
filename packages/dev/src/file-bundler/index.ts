import fsx from "fs-extra";
import glob from "fast-glob";
import type { Plugin } from "vite";

import { BANNER } from "../render";
import { resolvePath, fileGenerator } from "../base";

type ContextFolder = {
  folder: string;
  files: ResolvedFile[];
};

type Context = {
  files: ResolvedFile[];
  folders: ContextFolder[];
};

type ContextHandler = (data: Context) => unknown;

type Entry = {
  base: string;
  folders?: string[];
  pattern?: string | string[];
  ignore?: string | string[];
  defaultIgnore?: string | string[];
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

export function fileBundlerPlugin(entries: Entry[]): Plugin {
  async function resolveFiles(entry: Required<Entry>): Promise<ResolvedFile[]> {
    const files: ResolvedFile[] = [];

    const patterns = Array.isArray(entry.pattern)
      ? entry.pattern
      : [entry.pattern];

    const { folders } = entry;

    const patternMapper = (p: string) => {
      return folders.length
        ? folders.map((f) => resolvePath(entry.base, f, p))
        : [resolvePath(entry.base, p)];
    };

    const cwd = resolvePath(entry.base);

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
      if (match.path === resolvePath(entry.outfile)) {
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

  async function generateFiles() {
    const { generateFile } = fileGenerator();

    for (const _entry of entries) {
      const entry: Required<Entry> = {
        pattern: "**/*.ts",
        folders: [],
        ignore: [],
        defaultIgnore: ["**/_*", "**/@*"],
        context: (data) => data,
        ..._entry,
      };

      const files = await resolveFiles(entry);

      const template = await fsx.readFile(resolvePath(entry.template), "utf8");

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
