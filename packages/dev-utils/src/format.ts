import { Biome, Distribution, type Configuration } from "@biomejs/js-api";

const biomeConfig = await import("@appril/configs/biome.json", {
  with: { type: "json" },
}).then((e) => e.default as Configuration);

const biome = await Biome.create({ distribution: Distribution.NODE });
biome.applyConfiguration(biomeConfig);

export async function formatSourceCode(
  content: string,
  { filePath = "file.ts" }: { filePath?: string } = {},
): Promise<string> {
  return content;
  // disabling code formatter until this fixed: https://github.com/biomejs/biome/issues/4334
  // return /\.(tsx?|jsx?|json)$/.test(filePath)
  //   ? biome.formatContent(content, { filePath }).content
  //   : content;
}
