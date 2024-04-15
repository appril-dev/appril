import type { TableDeclaration } from "@appril/pgts";

import type {
  ApiTemplates,
  ClientTemplates,
  DefaultTemplates,
} from "@appril/crud";

export type { TableDeclaration };

export type TableAssets = {
  // tabme name for tables or alias name for aliases
  basename: string;
  apiPath: string;
  // path to file, relative to apiDir, eg. crud/products
  apiFile: string;
  apiFileFullpath: string;
  // fetch URL, eg. /admin/api/crud/products
  fetchBase: string;
  meta: Record<string, unknown>;
};

// biome-ignore format:
export type Table = TableDeclaration & TableAssets & {
  aliasOf?: string;
}

export type TableAlias = Pick<
  Table,
  "basename" | "apiPath" | "apiFile" | "apiFileFullpath" | "fetchBase"
> & {
  // basename of parent table
  aliasOf: string;
};

export type Options = {
  base: string;

  dbxConfig: import("@appril/pgts").Config & {
    connection: string | import("@appril/pgts").ConnectionConfig;
    base: string;
  };

  /**
    allowing multiple schemas. default: [ public ]
    same name tables would render inconsistently,
    so consider serve schemas separately, each with own base.
    eg. products table contained in both public and store schemas:
    plugins: [
      crudPlugin({ base: "crud", schemas: [ "public" ] }),
      crudPlugin({ base: "crudStore", schemas: [ "store" ] }),
    ] */
  schemas?: string[];

  apiTemplates?: string | ApiTemplates;
  clientTemplates?: string | ClientTemplates;

  alias?: Record<string, string | string[]>;
  tableFilter?: (t: TableDeclaration) => boolean;
  meta?:
    | Record<string, Record<string, unknown>>
    | ((t: Omit<Table, "meta">) => Record<string, unknown>);
};

export type CustomTemplates = {
  [K in keyof DefaultTemplates]: Partial<DefaultTemplates[K]>;
};
