import { Biome, Distribution, type Configuration } from "@biomejs/js-api";

export async function formatSourceCode(
  content: string,
  { filePath = "file.ts" }: { filePath?: string } = {},
): Promise<string> {
  const biomeConfig = await import("@appril/configs/biome.json", {
    with: { type: "json" },
  }).then((mdl) => mdl.default);

  const biome = await Biome.create({
    distribution: Distribution.NODE,
  });

  biome.applyConfiguration(biomeConfig as Configuration);

  return biome.formatContent(content, { filePath }).content;
}
