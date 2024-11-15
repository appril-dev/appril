import type {
  DefaultState,
  DefaultContext,
  APIMethod,
  RouteSpec,
  RouteSpecI,
  UseSpecI,
  UseOpt,
  Middleware,
} from "./types";

export const use: UseSpecI = (arg, opt?: UseOpt) => {
  assertValidMiddleware(arg);
  return {
    use: [arg].flat(),
    slot: opt?.slot,
    before: opt?.before ? [opt.before].flat() : undefined,
    after: opt?.after ? [opt.after].flat() : undefined,
  };
};

export const head: RouteSpecI = (arg) => definitionFactory("head", arg);
export const options: RouteSpecI = (arg) => definitionFactory("options", arg);
export const get: RouteSpecI = (arg) => definitionFactory("get", arg);
export const put: RouteSpecI = (arg) => definitionFactory("put", arg);
export const patch: RouteSpecI = (arg) => definitionFactory("patch", arg);
export const post: RouteSpecI = (arg) => definitionFactory("post", arg);
export const del: RouteSpecI = (arg) => definitionFactory("del", arg);

export function definitionFactory<
  StateT = DefaultState,
  ContextT extends DefaultContext = DefaultContext,
  ResponseBodyT = unknown,
>(method: APIMethod, arg: unknown): RouteSpec<StateT, ContextT, ResponseBodyT> {
  assertValidMiddleware(arg);
  return {
    method,
    middleware: [arg].flat() as Array<
      Middleware<StateT, ContextT, ResponseBodyT>
    >,
  };
}

function assertValidMiddleware(arg: unknown) {
  if (typeof arg !== "function") {
    if (Array.isArray(arg)) {
      if (arg.some((e) => typeof e !== "function")) {
        throw new Error("Provided array contains non-function entries");
      }
    } else {
      throw new Error("Expecting a function or an array of functions");
    }
  }
}
