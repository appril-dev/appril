import nopt from "nopt";
import { build } from "esbuild";

const { argv, ...opts } = nopt({});

for (const entryPoint of argv.remain) {
  await build({
    bundle: true,
    entryPoints: [`src/${entryPoint}.ts`],
    // overridable options
    ...Object.entries(opts).reduce((a, [k, v]) => {
      a[k.replace(/(\w)\-(\w)/g, (_m, a, b) => a + b.toUpperCase())] = v;
      return a;
    }, {}),
    outfile: `pkg/${entryPoint}.mjs`,
    platform: "node",
    target: "node20",
    format: "esm",
    loader: { ".hbs": "text" },
    packages: "external",
    sourcemap: "inline",
  });
}
