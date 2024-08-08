import type { ConnectionConfig } from "pg";

import type {
  Config as PgtsConfig,
  ColumnDeclaration,
  TableDeclaration,
  ViewDeclaration,
  EnumDeclaration,
} from "@appril/pgts";

export type {
  ColumnDeclaration,
  TableDeclaration,
  ViewDeclaration,
  EnumDeclaration,
};

export type Templates = {
  base?: string;
  table?: string;
  index?: string;
};

export type TypesTemplates = {
  index?: string;
  knexDts?: string;
};

export type MigrationsTemplates = {
  createTable?: string;
  alterTable?: string;
  dropTable?: string;
  generic?: string;
  knexfile?: string;
};

export type Config = PgtsConfig & {
  connection: string | ConnectionConfig;
  client: string;

  base: string;

  templates?: Templates;
  typesTemplates?: TypesTemplates;

  migrationDir: string;
  migrationSubdir?: string;
  migrationTemplates?: MigrationsTemplates;
  migrationSchema?: string;
  migrationTable?: string;
  disableTransactions?: boolean;

  plugins?: Array<GeneratorPlugin>;
};

export type DefaultConfig = Required<Pick<Config, "schemas">>;

export type GeneratorConfig = Config & DefaultConfig;
export type MigrationsConfig = Config & DefaultConfig;

export type GeneratorPlugin = (
  config: GeneratorConfig,
  data: {
    schemas: Array<string>;
    tables: Array<TableDeclaration>;
    views: Array<ViewDeclaration>;
    enums: Array<EnumDeclaration>;
  },
) => void | Promise<void>;
