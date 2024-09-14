import qs from "qs";

export default {
  responseMode: "json",
  get headers() {
    return {
      Accept: "application/json",
      "Content-Type": "application/json",
    };
  },
  stringify: (data) => {
    return qs.stringify(data, {
      arrayFormat: "brackets",
      indices: false,
      encodeValuesOnly: true,
    });
  },
  errorHandler: (_e) => undefined,
} satisfies import("./types").Defaults;
