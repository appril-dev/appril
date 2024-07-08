import type { JsonOptions, FormOptions, RawOptions } from "./@types";

export const json: JsonOptions = {
  limit: 1024 ** 2,
  trim: ["*"],
};

export const form: FormOptions = {
  limit: 1024 ** 2,
};

export const raw: RawOptions = {
  limit: 1024 ** 2,
};

export default {
  json,
  form,
  raw,
};
