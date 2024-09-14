export type HTTPMethod = "get" | "post" | "put" | "form" | "del";

export type DataParams = Record<string, unknown>;

export type BuildRequestOptions = {
  method: string;
  port?: number;
  json?: boolean;
  binary?: boolean;
  timeout?: number;
};

type SharedOptions = {
  port?: number;
  json?: boolean;
  headers?: { [key: string]: string };
  timeout?: number;
};

export type DelOptions = SharedOptions & {};

export type FormOptions = SharedOptions & {
  put?: boolean;
  binary?: boolean;
};

export type GetOptions = SharedOptions & {};

export type PostOptions = SharedOptions & {
  binary?: boolean;
};

export type PutOptions = SharedOptions & {
  binary?: boolean;
};
