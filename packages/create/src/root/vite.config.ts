import { basename, resolve, join } from "node:path";

import { defineConfig } from "vite";

import { distDir } from "./package.json";

export default async (sourceFolder: string) => {
  const {
    default: { devPort },
  } = await import(resolve(sourceFolder, "package.json"), {
    assert: { type: "json" },
  });

  const {
    default: { compilerOptions },
  } = await import(resolve(sourceFolder, "tsconfig.json"), {
    assert: { type: "json" },
  });

  return defineConfig({
    build: {
      outDir: resolve(
        sourceFolder,
        join("..", distDir, basename(sourceFolder)),
      ),
      emptyOutDir: true,
      sourcemap: true,
    },

    server: {
      host: true,
      port: devPort,
      strictPort: true,
      fs: {
        strict: false,
      },
    },

    cacheDir: resolve(sourceFolder, "var/.cache"),

    resolve: {
      alias: Object.entries(
        compilerOptions?.paths as Record<string, Array<string>>,
      ).reduce((map: Record<string, string>, [k, v]) => {
        map[k.replace("/*", "")] = resolve(
          sourceFolder,
          v[0].replace("/*", ""),
        );
        return map;
      }, {}),
    },
  });
};
