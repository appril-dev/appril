/// <reference path="./env.d.ts" />

import { type Middleware, useGlobal } from "@appril/api/router";
import { bodyparser } from "@appril/api/bodyparser";

useGlobal("bodyparser", bodyparser.json()).before("post", "put", "patch");

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
  // when string thrown, use status code 400
  if (typeof error === "string") {
    return [400, error];
  }

  if (Array.isArray(error)) {
    return [Number(error[0]) || 400, error[1] || "Unknown Error Occurred"];
  }

  if (error instanceof Error) {
    return [400, error.message];
  }

  return [500, "Unknown Error Occurred"];
}
