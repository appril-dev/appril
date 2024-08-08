import { resolve } from "node:path";

import fsx from "fs-extra";
import crc32 from "crc/crc32";

import { render, renderWithFormat } from "./render";

// biome-ignore format:
const fileGeneratorQueue: Record<
  string,
  (() => Promise<void>)[] | undefined
> = {};

export function fileGenerator(base: string) {
  const generatedFiles = new Set<string>();

  type Render = {
    template: string;
    context: object;
    format?: boolean;
  } & import("./render").Options;

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
    const file = resolve(base, outfile);

    const worker = async () => {
      const text =
        typeof content === "string"
          ? content
          : content?.format
            ? await renderWithFormat(content.template, content.context)
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
