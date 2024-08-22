import type { Knex } from "knex";

import type {
  Config,
  Instance,
  TruncateOpts,
  Returning,
  QueryBuilder,
  CompositeReturn,
  IdT,
} from "./@types";

import * as extend from "./extend";
import "./@types.knex";

const customInspectSymbol = Symbol.for("nodejs.util.inspect.custom");

export * from "./@types";

export default function dbx<
  TableT extends Knex.TableNames = never,
  PKeyT = never,
  ExtraT = unknown,
  InstanceT = PKeyT extends string
    ? Instance<TableT>
    : Omit<Instance<TableT>, "primaryKey" | "whereId" | "save" | "saveMany">,
>(config: Config, extra?: ExtraT): CompositeReturn<InstanceT, TableT> & ExtraT {
  const { tableName, primaryKey } = config;

  const connection = config.connection.withUserParams({
    tableName,
    primaryKey,
  });

  const instance = {
    ...extend,
    ...extra,

    ...(primaryKey
      ? {
          primaryKey,

          whereId(id: IdT) {
            return connection(tableName).where(
              primaryKey,
              id,
            ) as QueryBuilder<TableT>;
          },

          save(id: IdT, data: unknown, returning: Returning = "*") {
            return connection(tableName)
              .where(primaryKey, id)
              .update(data)
              .returning(returning);
          },

          saveMany(ids: Array<IdT>, data: unknown, returning: Returning = "*") {
            return connection(tableName)
              .whereIn(primaryKey, ids.filter((e) => e) as Array<string>)
              .update(data)
              .returning(returning);
          },
        }
      : {}),

    connection,
    tableName,

    get knex(): QueryBuilder<TableT> {
      return connection(tableName);
    },

    raw: (raw: string, bindings: Array<unknown>) => {
      return connection.raw(raw, bindings);
    },

    now: () => connection.raw("now()"),

    async create(data: unknown, returning: Returning = "*") {
      const [rows] = await connection(tableName)
        .insert(data)
        .returning(returning);

      return rows;
    },

    async createMany(data: Array<unknown>, returning: Returning = "*") {
      const rows: Array<never> = [];

      for (const entry of data) {
        const [row]: Array<never> = await connection(tableName)
          .insert(entry)
          .returning(returning);

        rows.push(row);
      }

      return rows;
    },

    // biome-ignore lint:
    batchInsert(rows: Array<any>, batchSize = 1000) {
      // biome-ignore lint:
      return connection.batchInsert(tableName, rows as any, batchSize);
    },

    truncateCascade({ restartIdentity = false }: TruncateOpts = {}) {
      return connection.raw(
        `truncate table ?? ${
          restartIdentity ? "restart identity" : ""
        } cascade`,
        tableName,
      );
    },

    toString: () => tableName,
  };

  // using inner target to avoid infinite loops
  // biome-ignore lint:
  const proxyTarget: any = function () {};

  proxyTarget[customInspectSymbol] = () => tableName;

  const proxy: unknown = new Proxy(
    proxyTarget,
    proxyHandler(tableName, connection, instance),
  );

  return proxy as CompositeReturn<InstanceT, TableT> & ExtraT;
}

// biome-ignore lint:
function proxyHandler(tableName: string, connection: any, instance: any) {
  return {
    // biome-ignore lint:
    get(_: any, prop: any) {
      if (prop in instance) {
        if (typeof instance[prop] === "function") {
          // biome-ignore lint:
          return function (this: any) {
            // biome-ignore lint:
            return instance[prop].apply(this, arguments);
          };
        }
        return instance[prop];
      }

      const conn = connection(tableName);

      if (typeof conn[prop] === "function") {
        return (...args: Array<unknown>) => {
          return conn[prop](...args);
        };
      }
      return conn[prop];
    },
  };
}
