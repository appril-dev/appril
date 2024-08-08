import type { Knex } from "knex";

export type IdT = number | string;

export type TruncateOpts = { restartIdentity?: boolean };

export type Returning = string | Array<string>;

export type QueryBuilder<TableT extends Knex.TableNames = never> =
  Knex.QueryBuilder<
    Knex.TableType<TableT>,
    Knex.ResolveTableType<Knex.TableType<TableT>>[]
  >;

export type Config = {
  connection: Knex;
  tableName: string;
  primaryKey?: string;
};

export type Instance<
  TableT extends Knex.TableNames = never,
  RecordT extends {} = Knex.ResolveTableType<Knex.TableType<TableT>>,
  InsertT extends {} = Knex.ResolveTableType<Knex.TableType<TableT>, "insert">,
  UpdateT extends {} = Knex.ResolveTableType<Knex.TableType<TableT>, "update">,
> = {
  connection: Knex;

  knex: QueryBuilder<TableT>;

  tableName: string;
  primaryKey: string;

  raw(raw: string, ...bindings: Array<unknown>): Knex.Raw;

  now(): Knex.Raw;

  whereId(id: number | string): QueryBuilder<TableT>;

  create(data: InsertT, returning?: Returning): Promise<RecordT>;

  createMany(
    data: Array<InsertT>,
    returning?: Returning,
  ): Promise<Array<RecordT>>;

  save(id: IdT, data: UpdateT, returning?: Returning): QueryBuilder<TableT>;

  saveMany(
    ids: Array<IdT>,
    data: UpdateT,
    returning?: Returning,
  ): QueryBuilder<TableT>;

  batchInsert(
    rows: Array<InsertT>,
    chunkSize?: number,
  ): Knex.BatchInsertBuilder<RecordT>;

  truncateCascade(opts: TruncateOpts): Knex.Raw;

  toString: () => string;
};

export type InstanceWithoutPrimaryKey<TableT extends Knex.TableNames = never> =
  Omit<Instance<TableT>, "primaryKey" | "whereId" | "save" | "saveMany">;

export type CompositeReturn<
  TInstance,
  TableT extends Knex.TableNames = never,
> = QueryBuilder<TableT> & TInstance & typeof import("./extend");
