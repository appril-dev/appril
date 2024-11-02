import qs from "qs";

export const stringify = (data: Record<string, unknown>) => {
  return qs.stringify(data, {
    arrayFormat: "brackets",
    indices: false,
    encodeValuesOnly: true,
  });
};

// node:path not suitable here cause lib also used client-side
export function join(...args: Array<unknown>): string {
  for (const a of args) {
    if (typeof a === "string" || typeof a === "number") {
      continue;
    }
    throw new Error(
      `The "path" argument must be of type string or number. Received type ${typeof a} (${JSON.stringify(a)})`,
    );
  }
  return args.join("/").replace(/\/+/g, "/");
}
