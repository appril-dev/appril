/// <reference path="./env.d.ts" />

import {
  type Middleware,
  type DefaultContext,
  useGlobal,
} from "@appril/api/router";

import { bodyparser } from "@appril/api/bodyparser";
import { DEV } from "~/config";

useGlobal("bodyparser", bodyparser.json()).before("post", "put", "patch");

useGlobal("payload", (ctx, next) => {
  defineProperty(ctx, "payload", () => {
    return (
      "body" in ctx.request ? ctx.request.body || {} : ctx.query
    ) as DefaultContext["payload"];
  });
  return next();
});

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

const defineProperty = <K extends keyof DefaultContext>(
  ctx: import("koa").Context,
  key: keyof DefaultContext,
  get: () => DefaultContext[K],
): void => {
  Object.defineProperty(ctx, key, {
    get,
    configurable: DEV, // should be swapable for hmr to work
  });
};
