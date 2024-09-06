const {
  DATABASE_SERVER: host,
  DATABASE_PORT: port = 5432,
  DATABASE_USER: user,
  DATABASE_NAME: database,
  DATABASE_PASSWORD: password,
  DATABASE_CLIENT: client = "pg",
} = process.env;

export const connection = {
  host,
  port: Number(port),
  user,
  database,
  password,
};

export { client };

export const baseDir = "db";

export const migrationDir = "migrations";
export const migrationDirSuffix = undefined;
export const migrationSchema = undefined; // use default
export const migrationTable = undefined; // use default

export const disableTransactions = false;
