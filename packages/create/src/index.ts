#!/usr/bin/env -S node --enable-source-maps --no-warnings=ExperimentalWarning

import { join } from "node:path";
import { format } from "node:util";

import fsx from "fs-extra";
import { run as depsBump } from "npm-check-updates";

import prompts, { type PromptObject } from "prompts";
import { defaults } from "@appril/configs";
import { renderToFile, resolveCwd } from "@appril/dev-utils";

import frameworks from "./frameworks";
import presets from "./presets";
import { copyFiles, type Context, type Questions } from "./base";

import gitignoreTpl from "./root/.gitignore.hbs";
import npmrcTpl from "./root/.npmrc.hbs";
import esbuildTpl from "./root/esbuild.hbs";
import packageTpl from "./root/package.hbs";
import tsconfigTpl from "./root/tsconfig.hbs";
import viteBaseTpl from "./root/vite.base.hbs";

import srcConfigTpl from "./src/config/index.hbs";
import srcApiAppTpl from "./src/api/app.hbs";
import srcApiServerTpl from "./src/api/server.hbs";

const onState: PromptObject["onState"] = (state) => {
  if (state.aborted) {
    // if exit with status code zero,
    // next job (if any) will continue running, assuming app created
    process.nextTick(() => process.exit(1));
  }
};

async function init() {
  const srcdir = (...path: Array<string>) => join(import.meta.dirname, ...path);
  const dstdir = (...path: Array<string>) => resolveCwd(project.name, ...path);

  const project = await prompts<Questions>([
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
      name: "srcFolders",
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
      choices: Object.entries(presets).map(([value, { title }]) => ({
        title,
        value,
        selected: true,
      })),
      hint: "- Space to select. Return to submit",
      onState,
    },
  ]);

  await copyFiles(srcdir("root"), dstdir(), {
    exclude: [/.+\.hbs/],
  });

  const srcFolders: Array<string> = [...project.srcFolders];

  const genericContext: Context = {
    project,
    solidFramework: project.framework === "solid",
    // coming from esbuild (define option)
    NODE_VERSION: String(process.env.APPRIL__NODE_VERSION),
    ESBUILD_TARGET: String(process.env.APPRIL__ESBUILD_TARGET),
    PACKAGE_MANAGER: String(process.env.APPRIL__PACKAGE_MANAGER),
  };

  {
    const context = {
      ...genericContext,
      defaults,
      srcFolders,
    };

    for (const [file, template] of [
      [".gitignore", gitignoreTpl],
      [".npmrc", npmrcTpl],
      ["esbuild.json", esbuildTpl],
      ["package.json", packageTpl],
      ["tsconfig.json", tsconfigTpl],
      ["vite.base.ts", viteBaseTpl],
    ]) {
      await renderToFile(dstdir(file), template, context, { format: true });
    }
  }

  const optedPresets: Array<keyof typeof presets> = [...project.presets];

  if (optedPresets.includes("pgxt")) {
    optedPresets.includes("dbxt") || optedPresets.push("dbxt");
  }

  for (const preset of optedPresets) {
    await presets[preset].worker(srcdir("presets"), dstdir(), genericContext);
  }

  const port = {
    value: project.devPort - 2,
    get next() {
      this.value += 2;
      return this.value;
    },
  };

  for (const srcFolder of srcFolders) {
    await copyFiles(srcdir("src"), dstdir(srcFolder), {
      exclude: [/.+\.hbs/],
    });

    const baseContext = {
      ...genericContext,
      defaults,
      srcFolder,
      srcFolders,
    };

    const libApiDir = format(defaults.libDirFormat, defaults.apiDir);

    for (const [file, template] of [
      ["config/index.ts", srcConfigTpl],
      ["api/app.ts", srcApiAppTpl],
      ["api/server.ts", srcApiServerTpl],
    ]) {
      const context = {
        ...baseContext,
        importPathmap: {
          app: [
            defaults.appPrefix,
            defaults.coreDir,
            defaults.apiDir,
            "app",
          ].join("/"),
          routes: [srcFolder, libApiDir, "routes"].join("/"),
        },
        baseurl:
          srcFolders.length === 1 || /front|src/.test(srcFolder)
            ? "/"
            : join("/", srcFolder.replace("@", "")),
      };

      await renderToFile(dstdir(srcFolder, file), template, context, {
        format: true,
      });
    }

    await frameworks[project.framework as keyof typeof frameworks](dstdir(), {
      srcFolder,
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
