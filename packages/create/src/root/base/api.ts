/// <reference path="./api.d.ts" />

import type { Middleware } from "koa";

import { useGlobal, use } from "@appril/router";

import {
  type JsonOptions,
  type FormOptions,
  type RawOptions,
  bodyparser,
} from "@appril/router/bodyparser";

import { DEV } from "~/config";

useGlobal("bodyparser", bodyparser.json()).before("post", "put", "patch");

useGlobal("payload", (ctx, next) => {
  Object.defineProperty(ctx, "payload", {
    get() {
      return "body" in ctx.request ? ctx.request.body || {} : ctx.query;
    },
    configurable: DEV, // should be swapable for hmr to work
  });
  return next();
});

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

export const errorHandler: Middleware = async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    const [code, message] = extractCodeWithMessage(error);

    ctx.status = code;
    ctx.body = { error: message };

    // triggering on("error") handler
    ctx.app.emit("error", error, ctx);
  }
};

function extractCodeWithMessage(error: unknown): [number, string] {
  // allows throwing strings:
  //   throw "some error"
  //   throw "500: some error"
  if (typeof error === "string") {
    // biome-ignore format:
    const [
      _, /** placeholder, ignore */
      code = 400,
      message = error,
    ] = error.trim().match(/^(\d+):\s*([^\0]+)/) || [];
    return [Number(code), message];
  }

  if (error instanceof Error) {
    return [400, error.message];
  }

  return [500, "Unknown Error Occurred"];
}
