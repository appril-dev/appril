import { join, resolve } from "node:path";

export * from "./file-generator";
export * from "./render";

const CWD = process.cwd();

export function resolveCwd(...path: string[]): string {
  return resolve(CWD, join(...path));
}

export function sanitizePath(path: string): string {
  return path.replace(/\.+\/+/g, "");
}
