export type PluginOptions = {
  apiurl: string;
  apiAssets?: {
    filter?: (route: ApiRoute) => boolean;
    typeMap?: Record<string, string | string[]>;
    importZodErrorHandlerFrom?: string;
  };
  apiGenerator?: {
    templates?: ApiTemplates;
  };
  fetchGenerator?: {
    filter?: (route: ApiRoute) => boolean;
  };
  solidPages?: {
    templates?: SolidTemplates;
  };
  crudGenerator?: import("./crud-generator/@types").Options;
  useWorkers?: boolean;
  usePolling?: boolean;
};

export type ResolvedPluginOptions = Required<
  Omit<PluginOptions, "solidPages" | "crudGenerator">
> & {
  sourceFolder: string;
  sourceFolderPath: string;
  solidPages?: PluginOptions["solidPages"];
  crudGenerator?: import("./crud-generator/@types").Options;
};

export type MiddleworkerPayloadTypes = Record<number, string>;

export type TypeFile = {
  file: string;
  importPath: string;
  content: string;
  routes: Set<string>;
};

export type TypeDeclaration = {
  text: string;
  importDeclaration?: {
    name: string;
    path: string;
  };
  typeAliasDeclaration?: {
    name: string;
    text: string;
  };
  interfaceDeclaration?: {
    name: string;
    text: string;
  };
};

export type FetchDefinition = {
  method: string;
  httpMethod: string;
  payloadType?: string;
  bodyType?: string;
};

export type RouteSection = {
  // :id -> :id
  // :id+o -> :id+o
  // :id.json -> :id.json
  // :id+o.json -> :id+o.json
  orig: string;
  // :id -> :id
  // :id+o -> :id+o
  // :id.json -> :id
  // :id+o.json -> :id+o
  base: string;
  // :id -> ""
  // :id+o -> ""
  // :id.json -> .json
  // :id+o.json -> .json
  ext: string;
  param?: {
    // :id -> id
    // :id.json -> id
    // :id+o -> id
    // :id+o.json -> id
    name: string;
    isOpt?: boolean;
    isRest?: boolean;
  };
};

export type ApiRouteConfig = {
  // override default prefix
  prefix?: string;

  // relative to apiDir
  file?: string;

  template?: string;
  templateContext?: Record<string, unknown>;

  /**
   * simple alias, will serve /login and /authorize
   * "login": { "alias": "authorize" }
   *
   * multiple aliases, will serve /login, /authorize and /authenticate
   * "login": { "alias": [ "authorize", "authenticate" ] }
   *
   * alias for dynamic routes, will serve /users/:id and /customers/:id
   * "users/:id": { "find": "users", "replace": "customers" }
   *
   * multiple dynamic aliases
   * will serve /cms/:page.html, /pages/:page.html and /content/:page.html
   * "cms/:page.html": [
   *   { "find": "cms", "replace": "pages" },
   *   { "find": "cms", "replace": "content" },
   * ]
   * */
  alias?:
    | string
    | { find: string; replace: string }
    | (string | { find: string; replace: string })[];

  meta?: Record<string, unknown>;
};

export type ApiRoute = {
  prefix?: string;
  path: string;
  originalPath: string;
  paramsType: string;
  fetchParamsType: string;
  // relative file path
  file: string;
  fileFullpath: string;
  srcFile: string;
  optedFile?: string;
  importName: string;
  importPath: string;
  meta?: Record<string, unknown>;
  template?: string;
  templateContext?: Record<string, unknown>;
  // path of parent
  aliasOf?: string;
};

export type ApiRouteAlias = Pick<
  ApiRoute,
  "prefix" | "path" | "originalPath" | "importName"
> & { aliasOf: string };

export type ApiTemplates = {
  route?: string;
};

export type SolidPageConfig = {
  dataLoader?: boolean | string;
  meta?: Record<string, unknown>;
};

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

export type SolidTemplates = {
  page?: string;
};

// biome-ignore format:
export type BootstrapPayload<
  T extends { bootstrap: (_p: never) => void }
> = Parameters<T["bootstrap"]>[0];
