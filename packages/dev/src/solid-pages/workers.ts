import { join } from "node:path";

import { stringify } from "smol-toml";

import type { SolidPage, SolidTemplates } from "../@types";
import { BANNER } from "../render";
import { fileGenerator, upsertTsconfigPaths } from "../base";
import { defaults } from "../defaults";

import pageTpl from "./templates/page.hbs";
import routesTpl from "./templates/routes.hbs";
import assetsTpl from "./templates/assets.hbs";
import dataTpl from "./templates/var/data.hbs";

const { generateFile } = fileGenerator();

let sourceFolder: string;
let sourceFolderPath: string;
let routerDir: string;
let storesDir: string;
let pagesDir: string;
let apiDir: string;
let varDir: string;

export async function bootstrap(data: {
  pages: SolidPage[];
  sourceFolder: string;
  sourceFolderPath: string;
  routerDir: string;
  storesDir: string;
  pagesDir: string;
  apiDir: string;
  varDir: string;
  customTemplates: SolidTemplates;
}) {
  const { customTemplates } = data;

  sourceFolder = data.sourceFolder;
  sourceFolderPath = data.sourceFolderPath;
  routerDir = data.routerDir;
  storesDir = data.storesDir;
  pagesDir = data.pagesDir;
  apiDir = data.apiDir;
  varDir = data.varDir;

  await upsertTsconfigPaths(join(sourceFolderPath, "tsconfig.json"), {
    [`${defaults.generated.data}/*`]: [
      ".",
      varDir,
      defaults.generated.data,
      "*",
    ].join("/"),
  });

  for (const page of data.pages) {
    await generatePageFiles({ page, customTemplates });
  }

  await generateIndexFiles(data);
}

export async function handleSrcFileUpdate({
  file,
  pages,
  customTemplates,
}: { file: string; pages: SolidPage[]; customTemplates: SolidTemplates }) {
  // making sure newly added pages have files generated
  for (const page of pages.filter((e) => e.srcFile === file)) {
    await generatePageFiles({ page, customTemplates });
  }

  await generateIndexFiles({ pages });
}

async function generatePageFiles({
  page,
  customTemplates,
}: { page: SolidPage; customTemplates: SolidTemplates }) {
  await generateFile(
    join(pagesDir, page.file),
    {
      template: customTemplates.page || pageTpl,
      context: page,
    },
    { overwrite: false },
  );

  if (page.dataLoaderGenerator) {
    await generateFile(
      join(varDir, `${page.dataLoaderGenerator.datafile}.ts`),
      {
        template: dataTpl,
        context: { BANNER, defaults, ...page },
      },
    );
  }
}

async function generateIndexFiles(data: { pages: SolidPage[] }) {
  const pages = data.pages.sort((a, b) => a.path.localeCompare(b.path));

  for (const [outfile, template] of [
    [defaults.solidPages.routesFile, routesTpl],
    [defaults.solidPages.assetsFile, assetsTpl],
  ]) {
    await generateFile(join(routerDir, outfile), {
      template,
      context: {
        BANNER,
        defaults,
        sourceFolder,
        pages,
        pagesDir,
        storesDir,
      },
    });
  }

  {
    const reducer = (map: Record<string, object>, page: SolidPage) => {
      if (page.dataLoaderGenerator) {
        map[page.dataLoaderGenerator.apiEndpoint] = {};
      }
      return map;
    };

    const content = [
      BANNER.trim().replace(/^/gm, "#"),
      stringify(pages.reduce(reducer, {})),
    ].join("\n");

    await generateFile(
      join(apiDir, defaults.generated.data, defaults.api.sourceFile),
      content,
    );
  }
}
