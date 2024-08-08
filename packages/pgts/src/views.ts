import type { ViewColumn, MaterializedViewColumn } from "extract-pg-schema";

import { columnsIterator } from "./columns";

import {
  defaultViewNominator,
  defaultModelNominator,
  defaultModulePrefix,
} from "./nominators";

import type {
  ResolvedConfig,
  ViewDeclaration,
  EnumDeclaration,
} from "./@types";

type ViewAssets = {
  name: string;
  columns: Array<ViewColumn> | Array<MaterializedViewColumn>;
};

export function viewsMapper(
  config: ResolvedConfig,
  schema: string,
  enums: Array<EnumDeclaration>,
) {
  const {
    viewFilter,
    viewNominator,
    modelNominator,
    viewSuffix,
    queryBuilderSuffix,
    modulePrefix = defaultModulePrefix,
  } = config;

  return (view: ViewAssets): Array<ViewDeclaration> => {
    const { name } = view;

    if (!viewFilter(name, { schema })) {
      [];
    }

    const columns = columnsIterator(config, schema, name, view.columns, enums);

    const declaredName = viewNominator(name, {
      schema,
      defaultNominator: defaultViewNominator,
    });

    const recordName = declaredName + viewSuffix;
    const queryBuilder = declaredName + queryBuilderSuffix;

    const modelName = modelNominator(name, {
      schema,
      defaultNominator: defaultModelNominator,
    });

    return [
      {
        schema,
        name,
        fullName: [schema, name].join("."),
        modelName,
        moduleName: `${modulePrefix}:${schema}.${name}`,
        primaryKey: columns.find((e) => e.isPrimaryKey)?.name,
        declaredName,
        recordName,
        queryBuilder,
        columns,
      },
    ];
  };
}
