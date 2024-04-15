// placeholder file, to be replaced with real values on module build

import type { ZodTypeAny, z } from "zod";
import type { ApiTypesLiteral } from "@appril/crud";

export * from "./apiTypes";

export type ItemT = object & { id: number | string };
export type ItemI = object;
export type ItemU = object;

export type PKeyT = ItemT["id"];

export const primaryKey = "id";
export const modelName = "";

export const fetchBase = "";
export const fetchOptions = {};

export const apiTypes: ApiTypesLiteral = {
  EnvT: false,
  ListAssetsT: false,
  ItemAssetsT: false,
};

export const regularColumns: (keyof ItemT)[] = [];

export const zodSchema: (_z: typeof z) => Record<string, ZodTypeAny> = () => {
  return {};
};

export const zodErrorHandler = (_e: unknown) => {};
