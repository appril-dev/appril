export const hostname = process.env.HOSTNAME ?? "";
export const NODE_ENV = process.env.NODE_ENV ?? "development";
export const DEV = NODE_ENV === "development";

export default {
  hostname,
  NODE_ENV,
  DEV,
};
