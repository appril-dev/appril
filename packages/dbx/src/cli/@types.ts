import type { ConnectionConfig } from "pg";

import type {
  Config as PgtsConfig,
  TableDeclaration,
  ViewDeclaration,
  EnumDeclaration,
} from "@appril/pgts";

export type { TableDeclaration, ViewDeclaration, EnumDeclaration };

export type Templates = {
  base?: string;
  index?: string;
  table?: string;
};

export type TypesTemplates = {
  index?: string;
  knexDts?: string;
  moduleDts?: string;
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
};

export type DefaultConfig = Required<Pick<Config, "schemas">>;

export type GeneratorConfig = Config & DefaultConfig;
export type MigrationsConfig = Config & DefaultConfig;
