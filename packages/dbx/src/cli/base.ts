import { resolve, join } from "node:path";

const CWD = process.cwd();

export const GENERATED_FILES_DIR = "generated-files-handler";

export function resolvePath(...path: string[]): string {
  return resolve(CWD, join(...path));
}

export function run(task: () => Promise<void>) {
  task()
    .then(() => process.exit(0))
    // biome-ignore lint:
    .catch((error: any) => {
      console.error(`\n  \x1b[31m×\x1b[0m ${error.message}\n`);
      console.error(error);
      process.exit(1);
    });
}
