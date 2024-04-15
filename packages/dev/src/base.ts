import { join, resolve } from "node:path";

import fsx from "fs-extra";
import crc32 from "crc/crc32";

import type { RouteSection } from "./@types";
import { render } from "./render";

const CWD = process.cwd();

export function resolvePath(...path: string[]): string {
  return resolve(CWD, join(...path));
}

export function sanitizePath(path: string): string {
  return path.replace(/\.+\/+/g, "");
}

export function normalizeRoutePath(path: string): string {
  return sanitizePath(path)
    .replace(/\/+/g, "/")
    .replace(/^\/|\/$/g, "");
}

export function routeSections(path: string): RouteSection[] {
  // use only normalized paths here
  return path.split("/").map((e, i) => {
    const [base, ext] = e.split(/(\..+)$/);

    let param: RouteSection["param"];

    if (base.startsWith(":")) {
      if (i === 0) {
        throw new Error(`Path should not start with a param - ${path}`);
      }
      param = {
        name: base.replace(":", "").replace(/\+[oa]$/, ""),
        isOpt: base.endsWith("+o"),
        isAny: base.endsWith("+a"),
      };
    }

    return {
      orig: e,
      base,
      ext: ext || "",
      param,
    } satisfies RouteSection;
  });
}

// biome-ignore format:
const fileGeneratorQueue: Record<
  string,
  (() => Promise<void>)[] | undefined
> = {};

export function fileGenerator() {
  const generatedFiles = new Set<string>();

  type Render = { template: string; context: object };
  type Options = { overwrite?: boolean };

  function generateFile<RenderContext = object>(
    outfile: string,
    render: Render,
    options?: Options,
  ): Promise<void>;

  function generateFile(
    outfile: string,
    content: string,
    options?: Options,
  ): Promise<void>;

  async function generateFile(
    ...args: [f: string, c: string | Render, o?: Options]
  ) {
    const [outfile, content, options] = args;
    const file = resolvePath(outfile);

    const worker = async () => {
      // biome-ignore format:
      const text = typeof content === "string"
        ? content
        : render(content.template, content.context);

      // two fs calls (check existence and read file)
      // is a good price for not triggering watchers on every render
      if (await fsx.exists(file)) {
        if (options?.overwrite === false) {
          return;
        }
        if (crc32(text) === crc32(await fsx.readFile(file, "utf8"))) {
          return;
        }
      }

      await fsx.outputFile(file, text, "utf8");
    };

    if (Array.isArray(fileGeneratorQueue[file])) {
      fileGeneratorQueue[file]?.push(worker);
      return;
    }

    fileGeneratorQueue[file] = [];

    try {
      await worker();
      for (const worker of fileGeneratorQueue[file] || []) {
        await worker();
      }
      generatedFiles.add(file);
    } finally {
      fileGeneratorQueue[file] = undefined;
    }
  }

  return {
    generateFile,
    generatedFiles,
  };
}

export async function upsertTsconfigPaths(
  file: string,
  paths: Record<string, string>,
) {
  let tsconfig = JSON.parse(await fsx.readFile(file, "utf8"));
  let updateFile = false;

  for (const [key, val] of Object.entries(paths)) {
    if (tsconfig.compilerOptions.paths?.[key]?.includes?.(val)) {
      continue;
    }

    tsconfig = {
      ...tsconfig,
      compilerOptions: {
        ...tsconfig.compilerOptions,
        paths: {
          ...tsconfig.compilerOptions.paths,
          [key]: [val],
        },
      },
    };

    updateFile = true;
  }

  if (updateFile) {
    await fsx.writeJson(file, tsconfig, {
      spaces: 2,
    });
  }
}
