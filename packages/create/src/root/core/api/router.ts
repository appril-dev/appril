import type { HTTPMethod, Middleware } from "@appril/api";
import Router, { type RouterOptions } from "@koa/router";

export default (
  routeStack: Array<{
    path: string;
    originalPath: string;
    endpoints: Array<{ method: HTTPMethod; middleware: Array<Middleware> }>;
  }>,
  routerOptions?: RouterOptions,
): Router => {
  const router = new Router(routerOptions);

  for (const { path, originalPath, endpoints } of routeStack) {
    for (const { method, middleware } of endpoints) {
      router.register(
        path.replace(/\+/g, "\\+"),
        [method],
        middleware as Array<never>,
        { name: originalPath },
      );
    }
  }

  return router;
};
