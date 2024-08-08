import fsx from "fs-extra";
import handlebars from "handlebars";

import { formatSourceCode } from "./format";

export type Options = { noEscape?: boolean };

export function render<Context = object>(
  template: string,
  context: Context,
  options?: Options,
): string {
  const { noEscape = true } = { ...options };
  return handlebars.compile(template, { noEscape })(context);
}

export async function renderWithFormat(
  ...a: Parameters<typeof render>
): Promise<string> {
  return formatSourceCode(render(...a));
}

export async function renderToFile<Context = object>(
  file: string,
  template: string,
  context: Context,
  options?: Options & { overwrite?: boolean; format?: boolean },
): Promise<void> {
  const { overwrite, format, ...renderOpts } = { ...options };
  if (overwrite === false) {
    if (await fsx.exists(file)) {
      return;
    }
  }
  return fsx.outputFile(
    file,
    format
      ? await renderWithFormat(template, context, renderOpts)
      : render(template, context, renderOpts),
    "utf8",
  );
}
