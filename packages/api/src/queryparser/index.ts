import type Koa from "koa";
import type { DefaultState, DefaultContext } from "../router/@types";
import type { IParseOptions, IStringifyOptions } from "qs";
import { parse, stringify } from "qs";

export default function withQueryparser<
  T extends InstanceType<typeof Koa<DefaultState, DefaultContext>> = never,
>(
  app: T,
  _parseOptions: IParseOptions = {},
  _stringifyOptions: IStringifyOptions = {},
) {
  const parseOptions = {
    ignoreQueryPrefix: true,
    parseArrays: true,
    arrayLimit: 100,
    parameterLimit: 100,
    depth: 5,
    ..._parseOptions,
  };

  const stringifyOptions = {
    encodeValuesOnly: true,
    arrayFormat: "brackets",
    ..._stringifyOptions,
  } as const;

  const obj = {
    get query() {
      return parse((this as Koa.Request).querystring || "", parseOptions);
    },

    set query(obj: object) {
      (this as Koa.Request).querystring = stringify(obj, stringifyOptions);
    },
  };

  const entries = Object.getOwnPropertyNames(obj).map((name) => [
    name,
    Object.getOwnPropertyDescriptor(obj, name),
  ]) as [name: string, desc: PropertyDescriptor][];

  for (const [name, desc] of entries) {
    Object.defineProperty(app.request, name, desc);
  }

  return app;
}
