import { green, blue, red, grey, black, bgBlue, dim } from "kleur/colors";

import type { HTTPMethod, Middleware } from "../router/types";

type Printer = (line: string) => void;

const dot = "·";

function colorizeMethod(method: string): string {
  const color = {
    GET: green,
    POST: blue,
    PATCH: blue,
    PUT: blue,
    DELETE: red,
  }[method];

  return color?.(method) || method;
}

export function routePrinter(
  route: {
    path: string;
    file: string;
    endpoints: Array<{ method: HTTPMethod; middleware: Array<Middleware> }>;
  },
  printer: Printer | boolean = false,
) {
  if (!printer) {
    return;
  }

  const { file, path, endpoints } = route;
  const lines: Array<string> = ["\n"];

  lines.push(
    [`[ ${bgBlue(black(` ${path} `))} ]`, grey(` { file: ${file} }`)].join(""),
  );

  const methMaxlength = 7;

  for (const { method, middleware } of endpoints) {
    const stackLengthText = ` (stack size: ${middleware.length}) `;

    const coloredMethod = colorizeMethod(method);

    const methodText =
      method === "GET"
        ? `  ${coloredMethod}${grey("|HEAD")}`
        : `  ${coloredMethod}`;

    const spacesCount = method === "GET" ? 6 : 14 - method.length;

    const spaces = Array(spacesCount).fill(" ").join("");

    const dotsCount =
      Number(process.stdout.columns) -
      8 -
      methMaxlength -
      stackLengthText.length -
      4;

    const dots = dotsCount > 0 ? Array(dotsCount).fill(dot).join("") : 0;

    lines.push(
      [methodText, spaces, grey(stackLengthText), dim(grey(dots))].join(""),
    );
  }

  if (typeof printer === "function") {
    lines.map((e) => printer(e));
  } else if (printer) {
    lines.map((e) => console.log(e));
  }
}
