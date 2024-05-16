/// <reference path="./env.d.ts" />

import { type Middleware, use } from "@appril/router";

import {
  type JsonOptions,
  type FormOptions,
  type RawOptions,
  bodyparser,
} from "@appril/router/bodyparser";

export const passthrough: Middleware = (_ctx, next) => next();

export const useJsonBodyparser = (opts: JsonOptions = {}) => {
  return use("bodyparser", bodyparser.json(opts)).before(
    "post",
    "put",
    "patch",
  );
};

export const useFormBodyparser = (opts: FormOptions = {}) => {
  return use("bodyparser", bodyparser.form(opts)).before(
    "post",
    "put",
    "patch",
  );
};

export const useRawBodyparser = (opts: RawOptions = {}) => {
  return use("bodyparser", bodyparser.raw(opts)).before("post", "put", "patch");
};
