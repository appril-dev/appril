export type {};

declare module "koa" {
  // interface DefaultState {}
  // interface DefaultContext {}
}

declare module "@appril/router" {
  interface UseIdentities {
    bodyparser: string;
    payload: string;
  }
}
