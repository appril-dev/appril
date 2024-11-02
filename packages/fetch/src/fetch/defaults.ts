export default {
  responseMode: "json",
  get headers() {
    return {
      Accept: "application/json",
      "Content-Type": "application/json",
    };
  },
  errorHandler: (_e) => undefined,
} satisfies import("./types").Defaults;
