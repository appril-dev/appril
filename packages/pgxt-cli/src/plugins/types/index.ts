import { join } from "node:path";

import { fileGenerator } from "@appril/dev-utils";
import type { ColumnDeclaration, EnumDeclaration } from "@appril/pgxt";

import { type GeneratorPlugin, BANNER, enumsDir, typesDir } from "@/base";

import enumTpl from "./templates/enum.hbs";
import enumsTpl from "./templates/enums.hbs";
import tableTpl from "./templates/table.hbs";
import viewTpl from "./templates/view.hbs";
import typesTpl from "./templates/types.hbs";
import knexDtsTpl from "./templates/knex.d.hbs";

export default (): GeneratorPlugin => {
  return async function typesGenerator(
    { schemas, tables, views, enums },
    { root, baseDir, defaultSchema },
  ) {
    for (const schema of schemas) {
      const schemaEnums = enums.filter((e) => e.schema === schema);
      const schemaTables = tables.filter((e) => e.schema === schema);
      const schemaViews = views.filter((e) => e.schema === schema);

      const { generateFile } = fileGenerator(
        join(root, baseDir, schema === defaultSchema ? "" : schema),
      );

      for (const _enum of schemaEnums) {
        await generateFile(join(enumsDir, `${_enum.name}.ts`), {
          template: enumTpl,
          context: {
            BANNER,
            enum: _enum,
          },
          format: true,
        });
      }

      await generateFile("enums.ts", {
        template: enumsTpl,
        context: {
          BANNER,
          enumsDir,
          enums: schemaEnums,
        },
        format: true,
      });

      const enumsReducer = (
        acc: Array<EnumDeclaration>,
        col: ColumnDeclaration,
      ): Array<EnumDeclaration> => {
        if (!col.enumDeclaration) {
          return acc;
        }

        if (
          acc.some((e) => e.declaredName === col.enumDeclaration?.declaredName)
        ) {
          return acc;
        }

        acc.push(col.enumDeclaration);
        return acc;
      };

      for (const table of schemaTables) {
        await generateFile(join(typesDir, `${table.name}.ts`), {
          template: tableTpl,
          context: {
            BANNER,
            table,
            enums: table.columns.reduce(enumsReducer, []),
            enumsDir,
          },
          format: true,
        });
      }

      for (const view of schemaViews) {
        await generateFile(join(typesDir, `${view.name}.ts`), {
          template: viewTpl,
          context: {
            BANNER,
            view,
            enums: view.columns.reduce(enumsReducer, []),
            enumsDir,
          },
          format: true,
        });
      }

      await generateFile("types.ts", {
        template: typesTpl,
        context: {
          BANNER,
          typesDir,
          enumsDir,
          tables: schemaTables,
          views: schemaViews,
        },
        format: true,
      });

      await generateFile("knex.d.ts", {
        template: knexDtsTpl,
        context: {
          BANNER,
          typesDir,
          tables: schemaTables,
          views: schemaViews,
        },
        format: true,
      });
    }
  };
};
