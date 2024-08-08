declare module "knex" {
  namespace Knex {
    interface QueryBuilder<TRecord, TResult> {
      selectRaw(
        raw: string,
      ): import("knex").Knex.QueryBuilder<TRecord, TResult>;

      onConflictRaw(
        columns: string,
      ): import("knex").Knex.OnConflictQueryBuilder<TRecord, TResult>;
      onConflictRaw(
        columns: Array<string>,
      ): import("knex").Knex.OnConflictQueryBuilder<TRecord, TResult>;

      // sort of pluck but does not add column to select statement.
      // should be LAST statement!
      pick<T = never>(column: string): Promise<T | undefined>;

      minValue<TResult = never>(
        column: string | import("knex").Knex.Raw,
      ): Promise<TResult | undefined>;

      maxValue<TResult = never>(
        column: string | import("knex").Knex.Raw,
      ): Promise<TResult | undefined>;

      sumValue(column: string | import("knex").Knex.Raw): Promise<number>;
      avgValue(column: string | import("knex").Knex.Raw): Promise<number>;

      countRows(): Promise<number>;
      countDistinctRows(...columns: Array<string>): Promise<number>;
    }
  }
}

// needed for declared modules to be treated as augmented rather than ambient
export type {};
