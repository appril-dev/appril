export default {
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  packages: "external",
  sourcemap: "inline",
  logLevel: "info",
} satisfies Omit<import("esbuild").BuildOptions, "bundle"> & { bundle: true };
