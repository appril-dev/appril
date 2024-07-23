export * from "./@types";

export const BANNER = `/**
* @generated by @appril/dbx; do not modify manually!
*/`;

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
