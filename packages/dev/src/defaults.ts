export const customizableDefaults = {
  apiDir: "api",
  routerDir: "router",
  pagesDir: "pages",
  storesDir: "stores",
  varDir: "var",
  useWorkers: true,
  usePolling: true,
};

export const defaults = {
  api: {
    routesFile: "routes.ts",
    sourceFile: "_routes.toml",
  },
  solidPages: {
    routesFile: "routes.ts",
    sourceFile: "_routes.toml",
    assetsFile: "assets.ts",
  },
  generated: {
    api: "$api",
    data: "$data",
    fetch: "$fetch",
  },
};
