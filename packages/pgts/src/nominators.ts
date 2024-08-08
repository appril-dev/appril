import { camelCase, upperFirst } from "lodash-es";
import pluralize from "pluralize";

export const defaultModulePrefix = "pgts";

export function defaultNominator(name: string) {
  return upperFirst(camelCase(name));
}

export function defaultTableNominator(name: string) {
  return defaultNominator(name);
}

export function defaultEnumNominator(name: string) {
  return defaultNominator(name);
}

export function defaultViewNominator(name: string) {
  return defaultNominator(name);
}

export function defaultModelNominator(name: string) {
  return upperFirst(camelCase(pluralize.singular(name)));
}
