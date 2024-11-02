import { stringify, join } from "@appril/api/lib";

import type {
  Options,
  HTTPError,
  FetchMethod,
  FetchMapper,
  HTTPMethod,
} from "./types";

import defaults from "./defaults";

export { defaults };
export * from "./types";

type GenericObject = Record<string, unknown>;

type PathEntry = string | number;

export default (base: string | URL, opts?: Options): FetchMapper => {
  const { headers, responseMode, errorHandler, ...fetchOpts } = {
    ...defaults,
    ...opts,
  };

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
        ...fetchOpts,
        headers: { ...headers },
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
};
