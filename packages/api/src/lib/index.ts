import qs from "qs";

export type HostOpt =
  | string
  | { hostname: string; port?: number; secure?: boolean };

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

export function createHost(host: HostOpt): string {
  if (typeof host === "string") {
    return host;
  }

  if (typeof host === "object") {
    return [
      host.secure ? "https://" : "http://",
      host.hostname,
      host.port ? `:${host.port}` : "",
    ]
      .join("")
      .replace(/\/+$/, "");
  }

  throw new Error(
    "Expected host to be a string or an object containing following keys: { hostname: string; port?: number; secure?: boolean }",
  );
}
