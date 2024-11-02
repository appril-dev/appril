declare module "koa" {
  interface Request {
    body?: unknown;
    rawBody: string;
  }
}

export type HTTPMethod =
  | "HEAD"
  | "OPTIONS"
  | "GET"
  | "PUT"
  | "PATCH"
  | "POST"
  | "DELETE";

export type APIMethod =
  | "head"
  | "options"
  | "get"
  | "put"
  | "patch"
  | "post"
  | "del";

export enum APIMethods {
  head = "head",
  options = "options",
  get = "get",
  put = "put",
  patch = "patch",
  post = "post",
  del = "del",
}

// biome-ignore lint:
export interface DefaultState {}

// biome-ignore lint:
export interface DefaultContext {}

export interface UseIdentities {
  payload: string;
  bodyparser: string;
}

// biome-ignore lint:
export interface Meta {}

export type Middleware<StateT = DefaultState, ContextT = DefaultContext> = (
  ctx: ParameterizedContext<StateT, ContextT>,
  next: import("koa").Next,
) => unknown;

export type MiddlewareDefinition<
  StateT = DefaultState,
  ContextT = DefaultContext,
> = {
  method: APIMethod;
  middleware: Array<Middleware<StateT, ContextT>>;
};

export type ParameterizedContext<
  StateT = DefaultState,
  ContextT = DefaultContext,
> = import("koa").ParameterizedContext<
  StateT,
  ContextT &
    Omit<
      // dropping default params
      import("koa__router").RouterParamContext<StateT, ContextT>,
      "params"
    >
>;

// use throw inside handler to say NotFound (or another error):
// throw [ 404, "Not Found" ]
// throw [ 400, "Bad Request" ]
/** biome-ignore lint: */
type ManagedMiddlewareReturn = any | Promise<any>;

export type ManagedMiddleware<
  StateT = DefaultState,
  ContextT = DefaultContext,
> = (ctx: ParameterizedContext<StateT, ContextT>) => ManagedMiddlewareReturn;

export type UseScope = APIMethod | Array<APIMethod>;
export type UseScopeGlobal = APIMethod;

export type UseDefinitionBase<
  StateT = DefaultState,
  ContextT = DefaultContext,
> = {
  use: Array<Middleware<StateT, ContextT>>;
  name?: keyof UseIdentities;
};

export type UseFactory<TScope> = {
  before: (...p: Array<TScope>) => UseDefinition<TScope>;
  "@before": (m: APIMethod, p?: string) => boolean;
  after: (...p: Array<TScope>) => UseDefinition<TScope>;
  "@after": (m: APIMethod, p?: string) => boolean;
};

export type UseDefinition<
  /**/
  TScope = UseScope,
> = UseDefinitionBase & UseFactory<TScope>;

export interface DefinitionI<StateT = DefaultState, ContextT = DefaultContext> {
  <StateB = object, ContextB = object>(
    a: ManagedMiddleware<StateT & StateB, ContextT & ContextB>,
  ): MiddlewareDefinition<StateT & StateB, ContextT & ContextB>;

  <StateB = object, ContextB = object>(
    a: Array<Middleware<StateT & StateB, ContextT & ContextB>>,
  ): MiddlewareDefinition<StateT & StateB, ContextT & ContextB>;
}

export interface UseDefinitionI<
  StateT = DefaultState,
  ContextT = DefaultContext,
> {
  <StateB = object, ContextB = object>(
    a:
      | Middleware<StateT & StateB, ContextT & ContextB>
      | Array<Middleware<StateT & StateB, ContextT & ContextB>>,
  ): UseDefinition;
  <StateB = object, ContextB = object>(
    a: keyof UseIdentities,
    b:
      | Middleware<StateT & StateB, ContextT & ContextB>
      | Array<Middleware<StateT & StateB, ContextT & ContextB>>,
  ): UseDefinition;
}

export interface UseDefinitionGlobalI {
  (a: Middleware | Array<Middleware>): UseDefinition<UseScopeGlobal>;
  (
    a: keyof UseIdentities,
    b: Middleware | Array<Middleware>,
  ): UseDefinition<UseScopeGlobal>;
}

export type RouteDefinition = UseDefinition | MiddlewareDefinition;

export type RouteEndpoint = {
  method: HTTPMethod;
  middleware: Array<Middleware>;
};
