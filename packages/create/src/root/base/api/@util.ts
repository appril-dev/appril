/// <reference path="./env.d.ts" />

import type { DefaultContext } from "@appril/router";

import { DEV } from "~/config";

export const defineProperty = <K extends keyof DefaultContext>(
  ctx: import("koa").Context,
  key: keyof DefaultContext,
  get: () => DefaultContext[K],
): void => {
  Object.defineProperty(ctx, key, {
    get,
    configurable: DEV, // should be swapable for hmr to work
  });
};
