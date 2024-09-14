import { randomUUID } from "node:crypto";

import type {
  Middleware,
  MiddlewareDefinition,
  APIMethod,
  HTTPMethod,
  UseDefinition,
  RouteEndpoint,
  RouteDefinition,
} from "./types";

import store from "./store";

export * from "./types";
export * from "./definitions";
export * as default from "./definitions";
export * from "./debug";

export function routeMapper(
  definitions: Array<RouteDefinition>,
  assets?: {
    payloadValidation?: Record<number, Array<Middleware>>;
  },
): Array<RouteEndpoint> {
  const { payloadValidation } = assets || {};

  const endpoints: Array<RouteEndpoint> = [];

  const useDefinitions: Array<UseDefinition> = [];

  const middlewareDefinitions: Array<
    MiddlewareDefinition & {
      payloadValidation?: Array<Middleware>;
    }
  > = [];

  for (const [i, definition] of definitions.entries()) {
    if ("use" in definition) {
      useDefinitions.push(definition);
    } else if ("middleware" in definition) {
      middlewareDefinitions.push({
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

  return endpoints;
}

function usePartitioner(
  useDefinitions: Array<UseDefinition>,
  method: APIMethod,
): [before: Array<Middleware>, Array<Middleware>] {
  const before: Record<string, Array<Middleware>> = {};
  const after: Record<string, Array<Middleware>> = {};

  const idFactory = (name: string | undefined): string => {
    return ["@use", method, name || randomUUID()].join(":");
  };

  for (const {
    use,
    name,
    ["@before"]: beforeFilter,
    ["@after"]: afterFilter,
  } of store.useGlobal) {
    const id = idFactory(name);
    if (beforeFilter(method)) {
      before[id] = use;
    }
    if (afterFilter(method)) {
      after[id] = use;
    }
  }

  for (const {
    use,
    name,
    ["@before"]: beforeFilter,
    ["@after"]: afterFilter,
  } of useDefinitions) {
    const id = idFactory(name);
    if (beforeFilter(method)) {
      before[id] = use;
    }
    if (afterFilter(method)) {
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
