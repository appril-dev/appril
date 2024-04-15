type Serialize = (v: unknown) => unknown;
type Stringify = (o: Record<string | number, unknown>) => string;
type ErrorHandler = (e: unknown) => void;

export type Config = {
  responseMode: ResponseMode;
  errorHandler?: ErrorHandler;
};

export type APIMethod = "get" | "post" | "put" | "patch" | "delete";

export type ResponseMode =
  | "json"
  | "text"
  | "blob"
  | "formData"
  | "arrayBuffer"
  | "raw";

export type Options = Pick<
  RequestInit,
  | "cache"
  | "credentials"
  | "headers"
  | "integrity"
  | "keepalive"
  | "mode"
  | "redirect"
  | "referrer"
  | "referrerPolicy"
  | "signal"
  | "window"
> & {
  serialize?: Serialize;
  stringify?: Stringify;
  responseMode?: ResponseMode;
  errorHandler?: ErrorHandler;
};

export type FetchMethod = <T = unknown>(...a: unknown[]) => Promise<T>;

export type FetchMapper = Record<APIMethod | "del", FetchMethod>;

export interface HTTPError<T extends object = object> extends Error {
  body: T;
  response: Response;
}
