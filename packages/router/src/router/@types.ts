import type {
  DefaultState,
  DefaultContext,
  Middleware,
  ParameterizedContext,
} from "koa";

declare module "koa" {
  interface DefaultContext {
    payload: Record<string, unknown>;
  }

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
export interface UseIdentities {}

// biome-ignore lint:
export interface Meta {}

export type MiddlewareDefinition<
  StateT = DefaultState,
  ContextT = DefaultContext,
> = {
  method: APIMethod;
  middleware: Middleware<StateT, ContextT>[];
  payloadValidation?: Middleware[];
};

export type MiddleworkerDefinition<
  StateT = DefaultState,
  ContextT = DefaultContext,
> = {
  method: APIMethod;
  middleworker: Middleworker<StateT, ContextT>;
  payloadValidation?: Middleware[];
};

// use throw inside handler when needed to say NotFound (or another error):
// throw "404: Not Found"
// throw "400: Bad Request"
// throw "statuscode: [some message]"
/** biome-ignore lint: */
type MiddleworkerReturn = any | Promise<any>;

export type Middleworker<StateT = DefaultState, ContextT = DefaultContext> = (
  ctx: ParameterizedContext<StateT, ContextT>,
  payload: never,
) => MiddleworkerReturn;

export interface DefinitionI<StateE = object, ContextE = object> {
  // biome-ignore lint:
  <StateT = DefaultState, ContextT = DefaultContext>(
    arg:
      | Middleworker<StateT & StateE, ContextT & ContextE>
      | Middleware<StateT & StateE, ContextT & ContextE>[],
  ):
    | MiddleworkerDefinition<StateT & StateE, ContextT & ContextE>
    | MiddlewareDefinition<StateT & StateE, ContextT & ContextE>;
}

export type UseScope = APIMethod | APIMethod[];
export type UseScopeGlobal = APIMethod;

export type UseDefinitionBase = {
  use: Middleware[];
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

export type RouteDefinition =
  | UseDefinition
  | MiddleworkerDefinition
  | MiddlewareDefinition;

export type RouteEndpoint = {
  method: HTTPMethod;
  middleware: Middleware[];
};
