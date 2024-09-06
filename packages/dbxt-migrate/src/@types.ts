export type UserConfig = {
  connection: object | string;
  client: string;
  baseDir: string;
  migrationDir: string;
  migrationDirSuffix?: string | (() => string | Promise<string>);
  migrationSchema?: string;
  migrationTable?: string;
  disableTransactions?: boolean;
};

export type ResolvedConfig = {
  connection: object | string;
  client: string;
  baseDir: string;
  migrationDir: string;
  migrationDirSuffix: string;
  migrationSchema?: string;
  migrationTable?: string;
  disableTransactions?: boolean;
};
