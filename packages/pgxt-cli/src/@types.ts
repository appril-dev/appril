import type {
  TableDeclaration,
  ViewDeclaration,
  EnumDeclaration,
} from "@appril/pgxt";

export type Config = {
  baseDir: string;
  connection: string | import("@appril/pgxt").ConnectionConfig;
  plugins?: Array<GeneratorPlugin>;
} & import("@appril/pgxt").Config;

export type GeneratorPluginConfig = { root: string; baseDir: string };

export type GeneratorPlugin = (
  data: {
    schemas: Array<string>;
    tables: Array<TableDeclaration>;
    views: Array<ViewDeclaration>;
    enums: Array<EnumDeclaration>;
  },
  config: GeneratorPluginConfig,
) => void | Promise<void>;
