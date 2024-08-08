#!/usr/bin/env node

import { join } from "node:path";

import fsx from "fs-extra";
import { run as depsBump } from "npm-check-updates";

import prompts, { type PromptObject } from "prompts";
import { defaults } from "@appril/dev";
import { renderToFile, resolveCwd } from "@appril/dev-utils";

import frameworks from "./frameworks";
import presets from "./presets";
import { copyFiles } from "./base";

import gitignoreTpl from "./root/.gitignore.hbs";
import packageTpl from "./root/package.hbs";
import tsconfigTpl from "./root/tsconfig.hbs";
import viteConfigTpl from "./root/vite.config.hbs";
import srcConfigTpl from "./src/config/index.hbs";
import srcTsconfigTpl from "./src/tsconfig.hbs";

const onState: PromptObject["onState"] = (state) => {
  if (state.aborted) {
    process.nextTick(() => process.exit(0));
  }
};

async function init() {
  const srcdir = (...path: Array<string>) => join(import.meta.dirname, ...path);
  const dstdir = (...path: Array<string>) => resolveCwd(project.name, ...path);

  const project = await prompts([
    {
      type: "text",
      name: "name",
      message: "Project Name",
      onState,
      validate(name) {
        if (!name?.length) {
          return "Please insert project name";
        }

        if (/[^\w\-\.]/.test(name)) {
          return "May contain only alphanumerics and hyphens/periods";
        }

        if (/^[\d|\W]+$/.test(name)) {
          return "Should contain at least one alpha char";
        }

        return true;
      },
    },

    {
      type: "select",
      name: "framework",
      message: "Pick a Framework",
      onState,
      choices: [{ title: "Solid", value: "solid" }],
    },

    {
      type: "list",
      name: "sourceFolders",
      message: "Source Folders",
      initial: "@admin @front",
      separator: " ",
      onState,
      async validate(input: string) {
        const dirs = input
          .trim()
          .split(/\s+/)
          .filter((e) => e.length);

        if (!dirs.length) {
          return "Please insert at least one source folder";
        }

        for (const dir of dirs) {
          if (/[^\w-.@]/.test(dir)) {
            return "May contain only alphanumerics and hyphens/periods";
          }

          if (/^[\d|\W]+$/.test(dir)) {
            return "Should contain at least one alpha char";
          }

          if (await fsx.pathExists(srcdir("src", dir))) {
            return `Can not use ${dir} as a source folder`;
          }
        }

        return true;
      },
    },

    {
      type: "text",
      name: "distDir",
      message: "Dist Folder",
      initial: ".dist",
      onState,
      validate(path: string) {
        if (/[^\w\-\.\/]/.test(path)) {
          return "May contain only alphanumerics and hyphens/periods/slashes";
        }

        if (/^[\d|\W]+$/.test(path)) {
          return "Should contain at least one alpha char";
        }

        if (/\.\.\//.test(path)) {
          return "Should not contain path traversal patterns";
        }

        return true;
      },
    },

    {
      type: "number",
      name: "devPort",
      message: "Dev Server Port",
      initial: 4000,
      onState,
    },

    {
      type: "multiselect",
      name: "presets",
      message: "Presets",
      choices: Object.keys(presets).map((title) => ({
        title,
        value: title,
        selected: true,
      })),
      hint: "- Space to select. Return to submit",
    },
  ]);

  await copyFiles(srcdir("root"), dstdir(), {
    exclude: [/.+\.hbs/],
  });

  const sourceFolders: Array<string> = project.sourceFolders;

  const sourceFoldersMapper = (
    render: (f: string, s: string) => Array<string>,
    folders: Array<string> = sourceFolders,
  ) => {
    return folders.flatMap((folder, i) => {
      return render(folder, folders[i + 1] ? "," : "");
    });
  };

  const genericContext = {
    project,
    solidFramework: project.framework === "solid",
    sourceFolders,
    defaults,
    packageManager: process.env.PACKAGE_MANAGER,
  };

  {
    const context = {
      ...genericContext,
      excludedSourceFolders: sourceFoldersMapper((folder, suffix) => [
        `"${folder}"${suffix}`,
      ]),
    };

    for (const [file, template] of [
      [".gitignore", gitignoreTpl],
      ["package.json", packageTpl],
      ["tsconfig.json", tsconfigTpl],
      ["vite.config.ts", viteConfigTpl],
    ]) {
      await renderToFile(dstdir(file), template, context, { format: true });
    }
  }

  for (const preset of project.presets) {
    await presets[preset as keyof typeof presets](srcdir("presets"), dstdir());
  }

  const port = {
    value: project.devPort - 2,
    get next() {
      this.value += 2;
      return this.value;
    },
  };

  for (const dir of sourceFolders) {
    await copyFiles(srcdir("src"), dstdir(dir), {
      exclude: [/.+\.hbs/],
    });

    const baseContext = {
      ...genericContext,
      project,
      excludedSourceFolders: sourceFoldersMapper(
        (folder, suffix) => [`"../${folder}"${suffix}`],
        sourceFolders.filter((f) => f !== dir),
      ),
    };

    for (const [file, template] of [
      ["config/index.ts", srcConfigTpl],
      ["tsconfig.json", srcTsconfigTpl],
    ]) {
      const baseurl =
        sourceFolders.length === 1 || /front|src/.test(dir)
          ? "/"
          : join("/", dir.replace("@", ""));

      const context = {
        ...baseContext,
        src: {
          baseurl,
        },
      };

      await renderToFile(dstdir(dir, file), template, context, {
        format: true,
      });
    }

    await frameworks[project.framework as keyof typeof frameworks](dstdir(), {
      sourceFolder: dir,
      devPort: port.next,
    });
  }

  await depsBump({
    cwd: dstdir(),
    prefix: dstdir(),
    format: ["group"],
    upgrade: true,
    silent: true,
    interactive: false,
  });
}

init().catch(console.error);
