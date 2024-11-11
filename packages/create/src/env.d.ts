declare module "*.hbs" {
  const src: string;
  export default src;
}

declare module "@/core/api/use" {
  export default () => [];
}

declare module "@/config" {
  export const DEV: boolean;
}

declare module "@/config/db" {
  export const connection;
  export const client = "";
  export const baseDir = "";
}
