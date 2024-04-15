import type { Knex } from "knex";

export type PKeyT = number | string;

export type TruncateOpts = { restartIdentity?: boolean };

export type Returning = string | string[];

export type QueryBuilder<TTable extends Knex.TableNames = never> =
  Knex.QueryBuilder<
    Knex.TableType<TTable>,
    Knex.ResolveTableType<Knex.TableType<TTable>>[]
  >;

export type Config = {
  connection: Knex;
  tableName: string;
  primaryKey: string;
};

export type ConfigWithoutPrimaryKey = Omit<Config, "primaryKey">;

export type Instance<
  TTable extends Knex.TableNames = never,
  TRecord = Knex.ResolveTableType<Knex.TableType<TTable>>,
  TInsert = Knex.ResolveTableType<Knex.TableType<TTable>, "insert">,
  TUpdate = Knex.ResolveTableType<Knex.TableType<TTable>, "update">,
> = {
  connection: Knex;

  knex: QueryBuilder<TTable>;

  tableName: string;
  primaryKey: string;

  raw(raw: string, ...bindings: unknown[]): Knex.Raw;

  now(): Knex.Raw;

  whereId(id: number | string): QueryBuilder<TTable>;

  create(data: TInsert, returning?: Returning): Promise<TRecord>;

  createMany(data: TInsert[], returning?: Returning): Promise<TRecord[]>;

  save(id: PKeyT, data: TUpdate, returning?: Returning): QueryBuilder<TTable>;

  saveMany(
    ids: PKeyT[],
    data: TUpdate,
    returning?: Returning,
  ): QueryBuilder<TTable>;

  batchInsert(
    rows: TInsert[],
    chunkSize?: number,
  ): Knex.BatchInsertBuilder<QueryBuilder<TTable>>;

  truncateCascade(opts: TruncateOpts): Knex.Raw;

  toString: () => string;
};

export type InstanceWithoutPrimaryKey<TTable extends Knex.TableNames = never> =
  Omit<Instance<TTable>, "primaryKey" | "whereId" | "save" | "saveMany">;

export type CompositeReturn<
  TInstance,
  TTable extends Knex.TableNames = never,
> = QueryBuilder<TTable> & TInstance & typeof import("./extend");
