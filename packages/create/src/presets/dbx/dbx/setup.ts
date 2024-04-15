import knex from "knex";

import { DEV } from "~/config";
import { connection as connectionSettings, client } from "~/config/knex";

export function connect(_connectionSettings = {}) {
  const instance = knex({
    client,
    connection: {
      ...connectionSettings,
      ..._connectionSettings,
    },
    asyncStackTraces: DEV,
    pool: {
      // biome-ignore lint:
      async afterCreate(conn: any, done: (...a: unknown[]) => void) {
        done(null, conn);
      },
    },
  });

  return instance;
}

export function disconnect(c = connection) {
  return c?.destroy();
}

export const connection = connect();
