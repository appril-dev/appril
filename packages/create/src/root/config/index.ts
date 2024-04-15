export const hostname = process.env.HOSTNAME ?? "";
export const DEBUG = Boolean(process.env.DEBUG);
export const NODE_ENV = process.env.NODE_ENV ?? "development";
export const DEV = NODE_ENV === "development";

export default {
  hostname,
  DEBUG,
  NODE_ENV,
  DEV,
};
