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

// biome-ignore lint:
export interface Meta {}

export type ParameterizedContext<
  StateT = DefaultState,
  ContextT = DefaultContext,
  ResponseBodyT = unknown,
> = import("koa").ParameterizedContext<
  StateT,
  ContextT &
    Omit<
      // dropping default params
      import("koa__router").RouterParamContext<StateT, ContextT>,
      "params"
    >,
  ResponseBodyT
>;

export type Middleware<
  StateT = DefaultState,
  ContextT = DefaultContext,
  ResponseBodyT = unknown,
> = (
  ctx: ParameterizedContext<StateT, ContextT, ResponseBodyT>,
  next: import("koa").Next,
) => unknown;

export type RouteSpec<
  StateT = DefaultState,
  ContextT = DefaultContext,
  ResponseBodyT = unknown,
> = {
  method: APIMethod;
  middleware: Array<Middleware<StateT, ContextT, ResponseBodyT>>;
};

export interface RouteSpecI<
  StateT = DefaultState,
  ContextT = DefaultContext,
  ResponseBodyT = unknown,
> {
  <StateC = object, ContextC = object>(
    a: Middleware<StateT & StateC, ContextT & ContextC, ResponseBodyT>,
  ): RouteSpec; // TODO: providing generics here somehow is breaking context typing
  <StateC = object, ContextC = object>(
    a: Array<Middleware<StateT & StateC, ContextT & ContextC, ResponseBodyT>>,
  ): RouteSpec;
}

// biome-ignore lint:
export interface UseSlots {}

export type UseOpt = {
  slot?: keyof UseSlots;
  before?: APIMethod | Array<APIMethod>;
  after?: APIMethod | Array<APIMethod>;
};

export type UseSpec<StateT = DefaultState, ContextT = DefaultContext> = {
  use: Array<Middleware<StateT, ContextT>>;
} & {
  slot?: keyof UseSlots;
  before?: Array<APIMethod>;
  after?: Array<APIMethod>;
};

export interface UseSpecI<StateT = DefaultState, ContextT = DefaultContext> {
  <State = object, Context = object>(
    use:
      | Middleware<StateT & State, ContextT & Context>
      | Array<Middleware<StateT & State, ContextT & Context>>,
  ): UseSpec<StateT & State, ContextT & Context>;
  <State = object, Context = object>(
    use:
      | Middleware<StateT & State, ContextT & Context>
      | Array<Middleware<StateT & State, ContextT & Context>>,
    opt?: UseOpt,
  ): UseSpec<StateT & State, ContextT & Context>;
}
