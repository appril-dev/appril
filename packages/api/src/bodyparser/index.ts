import zlib from "node:zlib";

import IncomingForm from "formidable";
import rawParser from "raw-body";

import type { Middleware } from "@/router/@types";

import type {
  JsonOptions,
  FormOptions,
  TrimOption,
  Trimmer,
  RawOptions,
} from "./@types";

import config from "./config";

export default { config, json, form, raw };

export { config };
export const bodyparser = { json, form, raw };
export * from "./@types";

export function json(opts: JsonOptions = {}): Array<Middleware> {
  return [
    async (ctx, next) => {
      const form = IncomingForm({
        maxFieldsSize: opts.limit || config.json.limit,
        ...opts,
      });

      const trimmer = trimmerFactory(opts.trim);

      ctx.request.body = await new Promise((resolve, reject) => {
        form.parse(ctx.request.req, (err, fields) => {
          if (err) {
            return reject(err);
          }

          resolve(trimmer ? trimmer(fields) : fields);
        });
      });

      return next();
    },
  ];
}

export function form(opts: FormOptions = {}): Array<Middleware> {
  return [
    async (ctx, next) => {
      const form = IncomingForm({
        maxFieldsSize: opts.limit || config.form.limit,
        maxFileSize: opts.limit || config.form.limit,
        ...opts,
      });

      let trimmer = trimmerFactory(opts.trim);

      if (opts.multipart || opts.urlencoded) {
        trimmer = undefined;
      }

      ctx.request.body = await new Promise((resolve, reject) => {
        form.parse(ctx.request.req, (err, fields, files) => {
          if (err) {
            return reject(err);
          }

          resolve({
            fields: trimmer ? trimmer(fields) : fields,
            files,
          });
        });
      });

      return next();
    },
  ];
}

export function raw(opts: RawOptions = {}): Array<Middleware> {
  return [
    async (ctx, next) => {
      const { chunkSize, ...rawParserOptions } = { ...config.raw, ...opts };

      const stream = ctx.request.req.pipe(zlib.createUnzip({ chunkSize }));
      ctx.request.body = await rawParser(stream, rawParserOptions);

      return next();
    },
  ];
}

function trimmerFactory(
  trimOption: TrimOption | undefined,
): Trimmer | undefined {
  if (!Array.isArray(trimOption) || !trimOption.length) {
    return;
  }

  const trimableKeys: {
    [key: string]: boolean;
  } = trimOption.reduce((m: Record<string, boolean>, k) => {
    m[k] = true;
    return m;
  }, {});

  const trim = (key: string, val: unknown) => {
    if (typeof val !== "string") {
      return val;
    }

    return trimableKeys[key] || trimableKeys["*"] ? val.trim() : val;
  };

  const reducer = (
    memo: Record<string, unknown>,
    [key, val]: [string, unknown],
  ) => {
    memo[key] = trim(key, val);
    return memo;
  };

  // accumulator is set to payload intentionally, to avoid duplication of big strings!
  // if using a new object for accumulator then trimmed strings will be duplicated!
  return (payload) => Object.entries(payload).reduce(reducer, payload);
}
