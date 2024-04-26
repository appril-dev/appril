import type { Knex } from "knex";
import knex from "knex";

export const selectRaw = function (this: Knex.QueryBuilder, raw: string) {
  return this.select(this.client.raw(raw));
};

// not exporting cause not supposed to be used in first place, chained only
const onConflictRaw = function (this: Knex.QueryBuilder, raw: string) {
  return this.onConflict(this.client.raw(raw));
};

export const pick = async function (this: Knex.QueryBuilder, column: string) {
  const result = await this;

  if (!result) {
    return;
  }

  if (Array.isArray(result)) {
    return result[0]?.[column];
  }

  return result[column];
};

export const minValue = async function <TResult = unknown>(
  this: Knex.QueryBuilder,
  column: string | Knex.Raw,
): Promise<TResult | undefined> {
  const [{ min }] = await this.min(column);
  return min;
};

export const maxValue = async function <TResult = unknown>(
  this: Knex.QueryBuilder,
  column: string | Knex.Raw,
): Promise<TResult | undefined> {
  const [{ max }] = await this.max(column);
  return max;
};

export const sumValue = async function (
  this: Knex.QueryBuilder,
  column: string | Knex.Raw,
): Promise<number> {
  const [{ sum }] = await this.sum(column);
  return Number(sum || 0);
};

export const avgValue = async function (
  this: Knex.QueryBuilder,
  column: string | Knex.Raw,
): Promise<number> {
  const [{ avg }] = await this.avg(column);
  return Number(avg || 0);
};

export const countRows = async function (
  this: Knex.QueryBuilder,
): Promise<number> {
  const [{ count }] = await countQueryBuilder(this).count({ count: "*" });
  return count ? Number(count) : 0;
};

export const countDistinctRows = async function (
  this: Knex.QueryBuilder,
  ...columns: string[]
): Promise<number> {
  const [{ count }] = await countQueryBuilder(this).countDistinct(...columns);
  return count ? Number(count) : 0;
};

function countQueryBuilder(queryBuilder: Knex.QueryBuilder) {
  const builder = queryBuilder
    .clone()
    .clear("columns") // dropping "columns" statements from query
    .clear("order"); // dropping "order" statements from query

  return builder;
}

knex.QueryBuilder.extend("selectRaw", selectRaw);
// @ts-ignore
knex.QueryBuilder.extend("onConflictRaw", onConflictRaw);

knex.QueryBuilder.extend("pick", pick);

// @ts-ignore
knex.QueryBuilder.extend("minValue", minValue);
// @ts-ignore
knex.QueryBuilder.extend("maxValue", maxValue);

// @ts-ignore
knex.QueryBuilder.extend("sumValue", sumValue);
// @ts-ignore
knex.QueryBuilder.extend("avgValue", avgValue);

// @ts-ignore
knex.QueryBuilder.extend("countRows", countRows);
// @ts-ignore
knex.QueryBuilder.extend("countDistinctRows", countDistinctRows);
