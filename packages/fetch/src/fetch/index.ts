import qs from "qs";

import type { Options, HTTPError, FetchMethod, FetchMapper } from "./types";

import config from "./config";

export { config, fetch };
export * from "./types";

type GenericObject = Record<string, unknown>;

type PathEntry = string | number;

type HTTPMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

const defaultHeaders = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

function fetch(base: string | URL, opts?: Options): FetchMapper {
  const {
    serialize = (d: unknown) => d,
    stringify = (data: unknown) => {
      return qs.stringify(data, {
        arrayFormat: "brackets",
        indices: false,
        encodeValuesOnly: true,
      });
    },
    responseMode,
    headers,
    errorHandler,
    ...fetchConfig
  } = { ...config, ...opts };

  function wrapper(method: HTTPMethod): FetchMethod {
    // no path no data
    function _wrapper<T>(): Promise<T>;

    // path without data
    function _wrapper<T>(path: PathEntry | Array<PathEntry>): Promise<T>;

    // path and data
    function _wrapper<T>(
      path: PathEntry | Array<PathEntry>,
      data: GenericObject,
    ): Promise<T>;

    function _wrapper<T>(
      _path?: PathEntry | Array<PathEntry>,
      _data?: GenericObject,
    ): Promise<T> {
      const path = Array.isArray(_path)
        ? _path
        : ["string", "number"].includes(typeof _path)
          ? [_path]
          : [];

      const data = Object.assign({}, _data || {});

      let url = join(String(base), ...(path as Array<PathEntry>));

      const config: Options & { method: HTTPMethod; body?: string } = {
        ...fetchConfig,
        headers: { ...defaultHeaders, ...headers },
        method,
      };

      if (["GET", "DELETE"].includes(method)) {
        const query = stringify(data);
        if (query.length) {
          url = [url, query].join("?");
        }
      } else {
        config.body = JSON.stringify(data);
      }

      return window
        .fetch(url, config)
        .then((response) =>
          Promise.all([
            response,
            responseMode === "raw"
              ? response
              : response[responseMode]().catch(() => null),
          ]),
        )
        .then(([response, data]) => {
          if (Math.floor(response.status / 100) !== 2) {
            const error = new Error(
              data?.error || response.statusText,
            ) as HTTPError;
            error.response = response;
            error.body = data;
            errorHandler?.(error);
            throw error;
          }

          return data;
        });
    }

    return _wrapper;
  }

  return {
    get: wrapper("GET"),
    post: wrapper("POST"),
    put: wrapper("PUT"),
    patch: wrapper("PATCH"),
    delete: wrapper("DELETE"),
    del: wrapper("DELETE"),
  };
}

const pathTypes: { [key: string]: boolean } = {
  "[object Number]": true,
  "[object String]": true,
};

function join(...args: Array<PathEntry>) {
  for (const a of args) {
    const type = Object.prototype.toString.call(a);
    if (!pathTypes[type]) {
      throw new Error(`join accepts only strings and numbers, ${type} given`);
    }
  }

  return args
    .filter((e) => e)
    .join("/")
    .replace(/\/+/g, "/");
}
