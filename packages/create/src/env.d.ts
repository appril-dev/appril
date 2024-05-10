declare module "~/init" {
  export type {};
}

declare module "~/config" {
  export const DEV: boolean;
}

declare module "~/config/knex" {
  export const connection;
  export const client = "";
}

declare module "~/base/api/app" {
  export const errorHandler = () => {};
}

declare module "@/config" {
  export const baseurl: string;
}

declare module "@/router/assets" {
  export type LinkProps = [""];
  export const linkReplcements = { "": (a) => string };
}
