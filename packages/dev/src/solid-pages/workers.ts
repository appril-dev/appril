import { join } from "node:path";

import { stringify } from "smol-toml";
import { fileGenerator } from "@appril/dev-utils";

import { type SolidPage, BANNER, defaults } from "../base";

import pageTpl from "./templates/page.hbs";
import routesTpl from "./templates/routes.hbs";
import assetsTpl from "./templates/assets.hbs";
import dataTpl from "./templates/var/data.hbs";

let sourceFolder: string;
let generateFile: ReturnType<typeof fileGenerator>["generateFile"];

export async function bootstrap(data: {
  root: string;
  sourceFolder: string;
  pages: Array<SolidPage>;
  template: string | undefined;
}) {
  const { template } = data;

  sourceFolder = data.sourceFolder;
  generateFile = fileGenerator(data.root).generateFile;

  for (const page of data.pages) {
    await generatePageFiles({ page, template });
  }

  await generateIndexFiles(data);
}

export async function handleSrcFileUpdate({
  file,
  pages,
  template,
}: { file: string; pages: Array<SolidPage>; template: string | undefined }) {
  // making sure newly added pages have files generated
  for (const page of pages.filter((e) => e.srcFile === file)) {
    await generatePageFiles({ page, template });
  }

  await generateIndexFiles({ pages });
}

async function generatePageFiles({
  page,
  template,
}: { page: SolidPage; template: string | undefined }) {
  await generateFile(
    join(defaults.pagesDir, page.file),
    {
      template: template || pageTpl,
      context: { page },
    },
    { overwrite: false },
  );

  if (page.dataLoaderGenerator) {
    await generateFile(
      join(defaults.varDir, `${page.dataLoaderGenerator.datafile}.ts`),
      {
        template: dataTpl,
        context: {
          page,
          importPathFetch: [
            defaults.appPrefix,
            sourceFolder,
            defaults.varDir,
            defaults.fetchDir,
            defaults.apiDir,
            defaults.apiDataDir,
          ].join("/"),
        },
      },
    );
  }
}

async function generateIndexFiles(data: { pages: Array<SolidPage> }) {
  const pages = data.pages.sort((a, b) => a.path.localeCompare(b.path));

  for (const [outfile, template] of [
    [defaults.routerRoutesFile, routesTpl],
    [defaults.routerAssetsFile, assetsTpl],
  ]) {
    await generateFile(join(defaults.varDir, defaults.routerDir, outfile), {
      template,
      context: {
        pages,
        importPathComponents: [
          defaults.appPrefix,
          sourceFolder,
          defaults.pagesDir,
        ].join("/"),
      },
    });
  }

  {
    const reducer = (map: Record<string, object>, page: SolidPage) => {
      if (page.dataLoaderGenerator) {
        map[page.dataLoaderGenerator.apiEndpoint] = { page: false };
      }
      return map;
    };

    const content = [
      BANNER.trim().replace(/^/gm, "#"),
      stringify(pages.reduce(reducer, {})),
    ].join("\n");

    await generateFile(defaults.dataSourceFile, content);
  }
}
