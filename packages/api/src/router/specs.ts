import type {
  DefaultState,
  DefaultContext,
  APIMethod,
  RouteSpec,
  RouteSpecI,
  UseSpecI,
  UseOpt,
} from "./types";

export const use: UseSpecI = (use, opt?: UseOpt) => {
  if (typeof use !== "function") {
    if (Array.isArray(use)) {
      if (use.some((e) => typeof e !== "function")) {
        throw new Error("Provided array contains non-function entries");
      }
    } else {
      throw new Error("Expecting a function or an array of functions");
    }
  }
  return {
    use: [use].flat(),
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
>(method: APIMethod, arg: unknown): RouteSpec<StateT, ContextT> {
  if (typeof arg === "function") {
    return {
      method,
      middleware: [
        async (ctx, next) => {
          ctx.body = await arg(ctx);
          return next();
        },
      ],
    };
  }

  if (Array.isArray(arg)) {
    return {
      method,
      middleware: [arg].flat(),
    };
  }

  throw new Error("Expected to receive a function or an array of functions");
}
