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

export interface DefaultContext {
  payload: Record<string, unknown>;
}

// biome-ignore lint:
export interface UseIdentities {}

// biome-ignore lint:
export interface Meta {}

export type Middleware<
  StateT = DefaultState,
  ContextT = DefaultContext,
  ResponseBodyT = unknown,
> = import("koa__router").Middleware<StateT, ContextT, ResponseBodyT>;

export type MiddlewareDefinition<
  StateT = DefaultState,
  ContextT = DefaultContext,
> = {
  method: APIMethod;
  middleware: Array<Middleware<StateT, ContextT>>;
};

// use throw inside handler when needed to say NotFound (or another error):
// throw "404: Not Found"
// throw "400: Bad Request"
// throw "statuscode: [some message]"
/** biome-ignore lint: */
type MiddleworkerReturn = any | Promise<any>;

type Middleworker<StateT = DefaultState, ContextT = DefaultContext> = (
  ctx: import("koa").ParameterizedContext<StateT, ContextT>,
  payload: never,
) => MiddleworkerReturn;

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
  before: (...p: TScope[]) => UseDefinition<TScope>;
  beforeMatch: (m: APIMethod, p?: string) => boolean;
  after: (...p: TScope[]) => UseDefinition<TScope>;
  afterMatch: (m: APIMethod, p?: string) => boolean;
};

// biome-ignore format:
export type UseDefinition<TScope = UseScope> = UseDefinitionBase & UseFactory<
  TScope
>;

type UseMiddleware<StateT, ContextT> =
  | Middleware<StateT, ContextT>
  | Array<Middleware<StateT, ContextT>>;

export interface DefinitionI<StateA = object, ContextA = object> {
  <StateB = object, ContextB = object>(
    a: Middleworker<
      DefaultState & StateA & StateB,
      DefaultContext & ContextA & ContextB
    >,
  ): MiddlewareDefinition<
    DefaultState & StateA & StateB,
    DefaultContext & ContextA & ContextB
  >;

  <StateB = object, ContextB = object>(
    a: Array<
      Middleware<
        DefaultState & StateA & StateB,
        DefaultContext & ContextA & ContextB
      >
    >,
  ): MiddlewareDefinition<
    DefaultState & StateA & StateB,
    DefaultContext & ContextA & ContextB
  >;
}

export interface UseDefinitionI<StateA = object, ContextA = object> {
  <StateB = object, ContextB = object>(
    a: UseMiddleware<
      DefaultState & StateA & StateB,
      DefaultContext & ContextA & ContextB
    >,
  ): UseDefinition;

  <StateB = object, ContextB = object>(
    a: keyof UseIdentities,
    b: UseMiddleware<
      DefaultState & StateA & StateB,
      DefaultContext & ContextA & ContextB
    >,
  ): UseDefinition;
}

export interface UseDefinitionGlobalI {
  (
    functions: UseMiddleware<DefaultState, DefaultContext>,
  ): UseDefinition<UseScopeGlobal>;

  (
    namespace: keyof UseIdentities,
    functions: UseMiddleware<DefaultState, DefaultContext>,
  ): UseDefinition<UseScopeGlobal>;
}

export type RouteDefinition = UseDefinition | MiddlewareDefinition;

export type RouteEndpoint = {
  method: HTTPMethod;
  middleware: Array<Middleware>;
};
