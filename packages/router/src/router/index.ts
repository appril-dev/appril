import { randomUUID } from "node:crypto";

import type { Middleware } from "koa";

import type {
  APIMethod,
  HTTPMethod,
  MiddlewareDefinition,
  MiddleworkerDefinition,
  UseDefinition,
  RouteEndpoint,
  RouteDefinition,
} from "./@types";

import store from "./store";

export * from "./@types";
export * from "./definitions";
export * as default from "./definitions";
export * from "./debug";

export function routeMapper(
  definitions: RouteDefinition[],
  assets?: {
    payloadValidation?: Record<number, Middleware[]>;
  },
): RouteEndpoint[] {
  const { payloadValidation } = assets || {};

  const endpoints: RouteEndpoint[] = [];

  const useDefinitions: UseDefinition[] = [];
  const middlewareDefinitions: MiddlewareDefinition[] = [];
  const middleworkerDefinitions: MiddleworkerDefinition[] = [];

  for (const [i, definition] of definitions.entries()) {
    if ("use" in definition) {
      useDefinitions.push(definition);
    } else if ("middleware" in definition) {
      middlewareDefinitions.push({
        ...definition,
        payloadValidation: payloadValidation?.[i],
      });
    } else if ("middleworker" in definition) {
      middleworkerDefinitions.push({
        ...definition,
        payloadValidation: payloadValidation?.[i],
      });
    }
  }

  for (const {
    method,
    middleware,
    payloadValidation,
  } of middlewareDefinitions) {
    const [before, after] = usePartitioner(useDefinitions, method);
    endpoints.push({
      method: httpMethodByApi(method),
      middleware: [
        ...before,
        ...(payloadValidation || []),
        ...middleware,
        ...after,
        () => true,
      ],
    });
  }

  for (const {
    method,
    middleworker,
    payloadValidation,
  } of middleworkerDefinitions) {
    const [before, after] = usePartitioner(useDefinitions, method);

    const middleware: Middleware[] = [
      async (ctx, next) => {
        ctx.body = await middleworker(ctx, ctx.payload as never);
        return next();
      },
    ];

    endpoints.push({
      method: httpMethodByApi(method),
      middleware: [
        ...before,
        ...(payloadValidation || []),
        ...middleware,
        ...after,
        () => true,
      ],
    });
  }

  return endpoints;
}

function usePartitioner(
  useDefinitions: UseDefinition[],
  method: APIMethod,
): [before: Middleware[], Middleware[]] {
  const before: Record<string, Middleware[]> = {};
  const after: Record<string, Middleware[]> = {};

  const idFactory = (name: string | undefined): string => {
    return ["@use", method, name || randomUUID()].join(":");
  };

  for (const { use, name, beforeMatch, afterMatch } of store.useGlobal) {
    const id = idFactory(name);
    if (beforeMatch(method)) {
      before[id] = use;
    }
    if (afterMatch(method)) {
      after[id] = use;
    }
  }

  for (const { use, name, beforeMatch, afterMatch } of useDefinitions) {
    const id = idFactory(name);
    if (beforeMatch(method)) {
      before[id] = use;
    }
    if (afterMatch(method)) {
      after[id] = use;
    }
  }

  return [Object.values(before).flat(), Object.values(after).flat()];
}

export function httpMethodByApi(apiMethod: APIMethod): HTTPMethod {
  return apiMethod === "del"
    ? "DELETE"
    : (apiMethod.toUpperCase() as HTTPMethod);
}
