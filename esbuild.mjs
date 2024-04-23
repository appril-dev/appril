import nopt from "nopt";
import { build } from "esbuild";

import config from "./esbuild.json" with { type: "json" };

const { argv, ...opts } = nopt({});

for (const entryPoint of argv.remain) {
  await build({
    entryPoints: [`src/${entryPoint}.ts`],
    outfile: `pkg/${entryPoint}.mjs`,
    ...config,
    ...Object.entries(opts).reduce((a, [k, v]) => {
      a[k.replace(/(\w)\-(\w)/g, (_m, a, b) => a + b.toUpperCase())] = v;
      return a;
    }, {}),
  });
}
