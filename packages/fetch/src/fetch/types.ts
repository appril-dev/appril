export interface Defaults {
  responseMode: ResponseMode;
  headers: Record<string, string>;
  stringify: (data: Record<string, unknown>) => string;
  errorHandler: (e: unknown) => void;
}

export type APIMethod = "get" | "post" | "put" | "patch" | "delete";

export type HTTPMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ResponseMode =
  | "json"
  | "text"
  | "blob"
  | "formData"
  | "arrayBuffer"
  | "raw";

export type Options = Partial<Defaults> &
  Pick<
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
  >;

export type FetchMethod = <T = unknown>(...a: Array<unknown>) => Promise<T>;

export type FetchMapper = Record<APIMethod | "del", FetchMethod>;

export interface HTTPError<T extends object = object> extends Error {
  body: T;
  response: Response;
}
