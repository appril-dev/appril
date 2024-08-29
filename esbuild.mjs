#!/usr/bin/env -S node --enable-source-maps --no-warnings=ExperimentalWarning

import nopt from "nopt";
import { build } from "esbuild";

import pkg from "./package.json" with { type: "json" };
import config from "./esbuild.json" with { type: "json" };

const { argv, ...opts } = nopt({});

for (const entryPoint of argv.remain) {
  await build({
    entryPoints: [`src/${entryPoint}.ts`],
    outfile: `pkg/${entryPoint}.mjs`,
    target: `node${pkg.nodeVersion.split(".")[0]}`,
    define: {
      "process.env.NODE_VERSION": JSON.stringify(pkg.nodeVersion),
      "process.env.PACKAGE_MANAGER": JSON.stringify(pkg.packageManager),
    },
    ...config,
    ...Object.entries(opts).reduce((a, [k, v]) => {
      a[k.replace(/(\w)\-(\w)/g, (_m, a, b) => a + b.toUpperCase())] = v;
      return a;
    }, {}),
  });
}
