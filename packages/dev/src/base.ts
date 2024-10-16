import { sanitizePath } from "@appril/dev-utils";

import type { RouteSection } from "./types";

export { defaults } from "@appril/configs";
export * from "./types";

export const BANNER = `/**
* @generated by @appril/dev; do not modify manually!
*/`;

export function normalizeRoutePath(path: string): string {
  return sanitizePath(path)
    .replace(/\/+/g, "/")
    .replace(/^\/|\/$/g, "");
}

export function routeSections(path: string, file: string): Array<RouteSection> {
  // use only normalized paths here

  const requiredParamRegex = /^\[([^\]]+)\]$/;
  const optionalParamRegex = /^\[\[([^\]]+)\]\]$/;
  const restParamRegex = /^\[\.\.\.([^\]]+)\]$/;

  return path.split("/").map((orig, i) => {
    const [base, ext] = orig.split(/(\.([\w\d-]+)$)/);

    let param: RouteSection["param"] | undefined;

    const paramSplitter = (regex: RegExp) => {
      const [name, type = "string"] = base
        .replace(regex, "$1")
        .split(":")
        .map((e) => e?.replace(/\s+/g, ""));

      if (!name) {
        throw new Error(`Invalid path detected: ${path}\n${file}`);
      }

      return [
        name,
        type
          .split("|") // whitespaces already stripped
          .map((e) =>
            ["number", "string"].includes(e)
              ? e
              : `"${e.replace(/^(['"])(.+)\1$/, "$2")}"`,
          )
          .join(" | "),
      ];
    };

    if (base.startsWith("[")) {
      // order is highly important!
      if (restParamRegex.test(base)) {
        const [name, type] = paramSplitter(restParamRegex);
        param = { name, type, isRest: true, isOpt: false };
      } else if (optionalParamRegex.test(base)) {
        const [name, type] = paramSplitter(optionalParamRegex);
        param = { name, type, isRest: false, isOpt: true };
      } else if (requiredParamRegex.test(base)) {
        const [name, type] = paramSplitter(requiredParamRegex);
        param = { name, type, isRest: false, isOpt: false };
      }
    }

    if (param && i === 0) {
      throw new Error(`Path should not start with a param - ${path}`);
    }

    return {
      orig: param ? orig.replace(/:[^\]]+/g, "") : orig,
      base: param ? base.replace(/:[^\]]+/g, "") : base,
      ext: ext || "",
      param,
    } satisfies RouteSection;
  });
}

export function httpMethodByApi(apiMethod: string): string {
  return apiMethod === "del" ? "DELETE" : apiMethod.toUpperCase();
}
