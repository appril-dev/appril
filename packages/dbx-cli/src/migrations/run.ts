import type { Knex } from "knex";

const migrateTasks: Record<
  "up" | "down" | "latest" | "rollback" | "list" | "unlock" | "version",
  (
    knex: Knex,
    opts?: { migrationName?: string; rollbackAll?: boolean },
  ) => Promise<void>
> = {
  up: async (knex, opts) => {
    const [batchNo, log] = await knex.migrate.up({
      name: opts?.migrationName,
    });
    if (log.length) {
      console.log(`Batch ${batchNo} ran ${log.length} migrations`, log);
    } else {
      console.log("Already up to date");
    }
  },

  down: async (knex, opts) => {
    const [batchNo, log] = await knex.migrate.down({
      name: opts?.migrationName,
    });
    if (log.length) {
      console.log(`Batch ${batchNo} rolled back ${log.length} migrations`, log);
    } else {
      console.log("Already at the base migration");
    }
  },

  latest: async (knex) => {
    const [batchNo, log] = await knex.migrate.latest();
    if (log.length) {
      console.log(`Batch ${batchNo} run: ${log.length} migrations`, log);
    } else {
      console.log("Already up to date");
    }
  },

  rollback: async (knex, opts) => {
    const [batchNo, log] = await knex.migrate.rollback(
      undefined,
      opts?.rollbackAll,
    );
    if (log.length) {
      console.log(`Batch ${batchNo} rolled back ${log.length} migrations`, log);
    } else {
      console.log("Already at the base migration");
    }
  },

  list: async (knex) => {
    const [completed, pending]: [c: Array<{ name: string }>, p: Array<string>] =
      await knex.migrate.list();

    console.log(`\n[ Completed migrations: ${completed.length} ]`);
    for (const { name } of completed) {
      console.log(name);
    }

    console.log(`\n[ Pending migrations: ${pending.length} ]`);
    for (const name of pending) {
      console.log(name);
    }
  },

  unlock: async (knex) => {
    await knex.migrate.forceFreeMigrationsLock();
    console.log("Succesfully unlocked the migrations lock table");
  },

  version: async (knex) => {
    const version = await knex.migrate.currentVersion();
    console.log(`Current Version: ${version}`);
  },
} as const;

export default migrateTasks;
