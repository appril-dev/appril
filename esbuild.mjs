import nopt from "nopt";
import { build } from "esbuild";

import pkg from "./package.json" with { type: "json" };
import config from "./esbuild.json" with { type: "json" };

const { argv, ...opts } = nopt({});

for (const entryPoint of argv.remain) {
  await build({
    entryPoints: [`src/${entryPoint}.ts`],
    outfile: `pkg/${entryPoint}.mjs`,
    define: {
      "process.env.PACKAGE_MANAGER": JSON.stringify(pkg.packageManager),
    },
    ...config,
    ...Object.entries(opts).reduce((a, [k, v]) => {
      a[k.replace(/(\w)\-(\w)/g, (_m, a, b) => a + b.toUpperCase())] = v;
      return a;
    }, {}),
  });
}
