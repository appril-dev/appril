import type {
  APIMethod,
  DefaultContext,
  HTTPMethod,
  Middleware,
  ParameterizedContext,
  RouteSpec,
  UseSpec,
} from "../router";

type ParamsSchema = Array<
  { name: string; isNumber: boolean } & Record<string, unknown>
>;

export const routeMiddlewareMapper = (
  routeName: string,
  setup: {
    paramsSchema: ParamsSchema;
    specs: Array<UseSpec | RouteSpec>;
    useSpecs: Array<UseSpec>;
    rules: {
      params: (ctx: ParameterizedContext) => void;
      payload: Partial<Record<APIMethod, (ctx: ParameterizedContext) => void>>;
      response: Partial<Record<APIMethod, (ctx: ParameterizedContext) => void>>;
    };
  },
) => {
  const specs: Array<RouteSpec> = [];
  const useSpecs: Array<UseSpec> = [];

  const stack: Array<{
    method: HTTPMethod;
    middleware: Array<Middleware>;
  }> = [];

  for (const [i, entry] of setup.specs.entries()) {
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
  const useSpecsGlobal = setup.useSpecs.filter(({ slot }) => {
    return slot ? !useSpecs.some((e) => e.slot === slot) : true;
  });

  // need payload and bodyparser slots to run before validators.
  // positional opts are ignored for these slots,
  // they always run before any middleware.
  const beforeValidators: Array<Middleware> = [];

  const useStack: Array<UseSpec> = [];

  for (const entry of [
    useSpecsGlobal, // globals should run first
    useSpecs,
  ].flat()) {
    if (!entry.slot || !["bodyparser", "payload"].includes(entry.slot)) {
      useStack.push(entry);
    } else {
      beforeValidators.push(...entry.use);
    }
  }

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

    const validateParams: Array<Middleware> = [
      (ctx, next) => {
        setup.rules.params(ctx);
        return next();
      },
    ];

    const validatePayload: Array<Middleware> = setup.rules.payload[method]
      ? [
          (ctx, next) => {
            setup.rules.payload[method]?.(ctx);
            return next();
          },
        ]
      : [];

    const validateResponse: Array<Middleware> = setup.rules.response[method]
      ? [
          async (ctx, next) => {
            await next();
            setup.rules.response[method]?.(ctx);
          },
        ]
      : [];

    stack.push({
      method: httpMethodByApi(method),
      middleware: [
        paramsCoerce(setup.paramsSchema),
        beforeValidators,
        validateParams,
        validatePayload,
        validateResponse,
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
