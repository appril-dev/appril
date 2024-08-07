import fsx from "fs-extra";
import handlebars from "handlebars";

type Options = { format?: boolean };

export function render<Context = object>(
  template: string,
  context: Context,
  options?: Options,
): string {
  const content = handlebars.compile(template, { noEscape: true })(context);
  return options?.format ? content.replace(/^\s*[\r\n]/gm, "") : content;
}

export async function renderToFile<Context = object>(
  file: string,
  template: string,
  context: Context,
  options?: Options & { overwrite?: boolean },
): Promise<void> {
  if (options?.overwrite === false) {
    if (await fsx.exists(file)) {
      return;
    }
  }
  return fsx.outputFile(file, render(template, context, options), "utf8");
}
