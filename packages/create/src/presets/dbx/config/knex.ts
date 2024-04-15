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
