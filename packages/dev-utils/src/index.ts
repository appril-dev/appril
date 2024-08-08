import { resolve, join } from "node:path";

export * from "./file-generator";
export * from "./render";
export * from "./format";

const CWD = process.cwd();

export function resolveCwd(...path: Array<string>): string {
  return resolve(CWD, join(...path));
}

export function sanitizePath(path: string): string {
  return path.replace(/\.+\/+/g, "");
}
