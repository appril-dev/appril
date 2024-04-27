import type { ConnectionConfig } from "pg";
import type { ZodTypeAny, z } from "zod";

export type { ConnectionConfig };

export type ExplicitType = { as: string };

export type ImportedType = {
  import: string;
  from: string;
  isArray?: boolean;
  isNullable?: boolean;
};

export type CustomType = string | ExplicitType | ImportedType;

export type CustomTypes = {
  [key: string]: CustomType | Record<string, CustomType>;
};

export type NominatorContext = {
  schema: string;
  defaultNominator: (name: string) => string;
};

export type FilterContext = {
  schema: string;
};

export type TableNominator = (
  name: string,
  context: NominatorContext,
) => string;
export type TableFilter = (name: string, context: FilterContext) => boolean;

export type EnumNominator = (name: string, context: NominatorContext) => string;
export type EnumFilter = (name: string, context: FilterContext) => boolean;

export type ViewNominator = (name: string, context: NominatorContext) => string;
export type ViewFilter = (name: string, context: FilterContext) => boolean;

export type ModelNominator = (
  name: string,
  context: NominatorContext,
) => string;

export type ZodFunction = (_z: typeof z) => ZodTypeAny;

export type ZodColumn = boolean | string | ZodFunction;

export type ZodTable = boolean | Record<string, ZodColumn>;

export type ZodConfig = Record<string, string | ZodTable>;

export type Config = {
  schemas?: string[];
  customTypes?: CustomTypes;
  recordSuffix?: string;
  insertSuffix?: string;
  updateSuffix?: string;
  enumSuffix?: string;
  viewSuffix?: string;
  queryBuilderSuffix?: string;
  tableNominator?: TableNominator;
  tableFilter?: TableFilter;
  enumNominator?: EnumNominator;
  enumFilter?: EnumFilter;
  viewNominator?: ViewNominator;
  viewFilter?: ViewFilter;
  modelNominator?: ModelNominator;
  zod?: ZodConfig;
};

export type DefaultConfig = Required<Omit<Config, "schemas" | "zod">>;

export type ResolvedConfig = Required<Config>;

export type EnumDeclaration = {
  schema: string;
  name: string;
  declaredName: string;
  values: string[];
  enumSuffix: string;
};

export type ColumnDeclaration = {
  type: string;
  kind: string;
  name: string;
  isPrimaryKey?: boolean;
  isOptional: boolean;
  isGenerated: boolean;
  isRegular: boolean;
  defaultValue: unknown;
  declaredType: string;
  comments: string[];
  zodSchema?: string;
};

export type TableDeclaration = {
  schema: string;
  name: string;
  fullName: string;
  primaryKey?: string;
  declaredName: string;
  recordName: string;
  insertName: string;
  updateName: string;
  queryBuilder: string;
  modelName: string;
  columns: ColumnDeclaration[];
  regularColumns: ColumnDeclaration[];
};

export type ViewDeclaration = {
  schema: string;
  name: string;
  fullName: string;
  primaryKey?: string;
  declaredName: string;
  recordName: string;
  queryBuilder: string;
  modelName: string;
  columns: ColumnDeclaration[];
};
