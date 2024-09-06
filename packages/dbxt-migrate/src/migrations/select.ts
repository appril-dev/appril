import prompts from "prompts";

export default async (
  migrationNames: Array<string>,
): Promise<Array<string>> => {
  // biome-ignore lint:
  function onState(this: any) {
    if (this.aborted) {
      process.nextTick(() => process.exit(1));
    }
  }

  const input = await prompts([
    {
      type: "multiselect",
      name: "migration",
      message: "Migration Name",
      choices: migrationNames.map((title) => ({ title, value: title })),
      initial: "",
      onState,
    },
  ]);

  return input.migration;
};
