import type { IncomingMessage, ServerResponse } from "node:http";

export type PluginOptions = {
  apiurl: string;

  apiAssets?: {
    filter?: (route: ApiRoute) => boolean;
    importZodErrorHandlerFrom?: string;
  };

  apiGenerator?: {
    // path to custom template, relative to vite.config.ts
    template?: string;
  };

  apiMiddleware?: (
    app: InstanceType<typeof import("koa")>,
  ) => (
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
  ) => Promise<void>;

  fetchGenerator?: {
    filter?: (route: ApiRoute) => boolean;
  };

  solidPages?: {
    // path to custom template, relative to vite.config.ts
    template?: string;
  };

  useWorkers?: boolean;

  watchOptions?: {
    usePolling?: boolean;
    awaitWriteFinish?:
      | boolean
      | {
          stabilityThreshold: number;
          pollInterval: number;
        };
  };
};

type PluginOptionsWithoutDefaults = "apiMiddleware" | "solidPages";

export type PluginOptionsResolved = {
  appRoot: string;
  sourceFolder: string;
} & Required<Omit<PluginOptions, PluginOptionsWithoutDefaults>> &
  Pick<PluginOptions, PluginOptionsWithoutDefaults>;

export type RouteSection = {
  orig: string;
  base: string;
  ext: string;
  param?: {
    name: string;
    type: string;
    isOpt?: boolean;
    isRest?: boolean;
  };
};

export type RouteOptions = {
  // api-related options

  // should generate api entry?
  api?: boolean;

  // use custom baseurl (eg. /) instead of default /api
  base?: string;

  // relative to apiDir
  file?: string;

  /**
   * simple alias; will serve /login and /authorize
   *  [login]
   *  alias = "authorize"
   *
   * multiple aliases; will serve /login, /authorize and /authenticate
   *  [login]
   *  alias = [ "authorize", "authenticate" ]
   *
   * alias for dynamic routes; will serve /users/[id] and /customers/[id]
   *  ["users/[id]"]
   *  alias = { find = "users", replace = "customers" }
   *
   * multiple dynamic aliases;
   * will serve /cms/[page].html, /pages/[page].html and /content/[page].html
   *  ["cms/[page].html"]
   *  alias = [
   *    { find = "cms", replace = "pages" },
   *    { find = "cms", replace = "content" },
   *  ]
   *
   * */
  alias?:
    | string
    | { find: string; replace: string }
    | (string | { find: string; replace: string })[];

  meta?: Record<string, unknown>;

  // solid-related options

  // should generate solid page?
  page?: boolean;

  dataLoader?: // no dataLoader by default
  // generate and consume default dataLoader
    | boolean
    // do not generate dataLoader, rather use default export of given file.
    | string
    // do not generate dataLoader, use default dataLoader of alias route.
    // error thrown if alias route has no default dataLoader.
    // error thrown even if alias route has dataLoader but it is a custom dataLoader.
    | { alias: string };
};

export type ApiRoute = {
  base?: string;
  path: string;
  originalPath: string;
  paramsType: string;
  paramsTypeConst: string;
  fetchParamsType: string;
  // relative file path
  file: string;
  fileFullpath: string;
  srcFile: string;
  optedFile?: string;
  importName: string;
  importPath: string;
  meta?: Record<string, unknown>;
  // path of parent
  aliasOf?: string;
};

export type ApiRouteAlias = Pick<
  ApiRoute,
  "base" | "path" | "originalPath" | "importName"
> & { aliasOf: string };

export type SolidPage = {
  path: string;
  originalPath: string;
  file: string;
  srcFile: string;
  importName: string;
  importPath: string;
  link: { base: string; props: string; replacements: string };
  meta?: string;
  dataLoaderGenerator?: {
    // where to save file that would contain data functions (useData, useDataStore and alike);
    // relative path
    datafile: string;
    // api path to be added to _routes.toml file.
    // api generator would generate a route based on this path.
    // then fetch generator generates a file containing typed fetch functions.
    apiEndpoint: string;
  };
  dataLoaderConsumer?: {
    // where from to import datafile (generated by dataLoaderGenerator)
    importDatafile: string;
    // the name of function to be imported from datafile
    importDatafunc: string;
    // inject useData when generating page. false when custom loader provided
    useData?: boolean;
  };
};

// biome-ignore format:
export type BootstrapPayload<
  T extends { bootstrap: (_p: never) => void }
> = Parameters<T["bootstrap"]>[0];

export type WatchHandler = (
  w: import("vite").ViteDevServer["watcher"],
) => void | Promise<void>;
