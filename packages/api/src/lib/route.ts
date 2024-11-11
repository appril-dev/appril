import type {
  DefaultContext,
  HTTPMethod,
  Middleware,
  RouteSpec,
  UseSpec,
} from "../router";

type ParamsSchema = Array<
  { name: string; isNumber: boolean } & Record<string, unknown>
>;

export const routeMiddlewareMapper = (
  routeName: string,
  {
    paramsSchema,
    factorySpecs,
    useGlobalSpecs,
  }: {
    paramsSchema: ParamsSchema;
    factorySpecs: Array<UseSpec | RouteSpec>;
    useGlobalSpecs: Array<UseSpec>;
  },
) => {
  const useSpecs: Array<UseSpec> = [];
  const specs: Array<RouteSpec> = [];

  const stack: Array<{
    method: HTTPMethod;
    middleware: Array<Middleware>;
  }> = [];

  for (const [i, entry] of factorySpecs.entries()) {
    if (Array.isArray((entry as unknown as UseSpec).use)) {
      useSpecs.push(entry as unknown as UseSpec);
    } else if (Array.isArray((entry as unknown as RouteSpec).middleware)) {
      specs.push(entry as unknown as RouteSpec);
    } else {
      throw new Error(
        `[ ${routeName} ]: Unknown spec at index ${i}: ${JSON.stringify(entry, null, 2)}`,
      );
    }
  }

  // excluding global specs that are overridden by a factory spec, regardless method
  const useSpecsGlobal = useGlobalSpecs.filter(({ slot }) => {
    return slot ? !useSpecs.some((e) => e.slot === slot) : true;
  });

  const useStack = [useSpecsGlobal, useSpecs].flat();

  for (const { method, middleware } of specs) {
    const before = [];
    const after = [];
    for (const use of useStack) {
      if (use.after?.length) {
        if (use.after.includes(method)) {
          after.push(...(use as UseSpec).use);
        }
        // if after provided, before ignored, even if no method matched
        continue;
      }
      if (!use.before || use.before.includes(method)) {
        before.push(...(use as UseSpec).use);
      }
    }
    stack.push({
      method: httpMethodByApi(method),
      middleware: [
        paramsCoerce(paramsSchema),
        before,
        middleware,
        after,
      ].flat(),
    });
  }

  return stack;
};

const paramsCoerce = (paramsSchema: ParamsSchema): Middleware => {
  return (ctx, next) => {
    const { params } = ctx as unknown as DefaultContext & {
      params: Record<string, unknown>;
    };
    for (const param of paramsSchema.filter((e) => e.isNumber)) {
      const value = params[param.name];
      if (Array.isArray(value)) {
        params[param.name] = value.map((e) => {
          return Number.isFinite(+e) ? Number(e) : e;
        });
      } else if (value && Number.isFinite(+value)) {
        params[param.name] = Number(value);
      }
    }
    return next();
  };
};

export function httpMethodByApi(apiMethod: string): HTTPMethod {
  return apiMethod === "del"
    ? ("DELETE" as const)
    : (apiMethod.toUpperCase() as HTTPMethod);
}
