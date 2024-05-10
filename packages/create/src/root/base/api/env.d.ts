// mandatory export for declared modules to be treated as augmented (rather than ambient)
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
