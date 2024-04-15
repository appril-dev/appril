import type { ViewColumn, MaterializedViewColumn } from "extract-pg-schema";

import { columnsIterator } from "./columns";

import { defaultViewNominator, defaultModelNominator } from "./nominators";

import type {
  ResolvedConfig,
  ViewDeclaration,
  EnumDeclaration,
  OnTypeImport,
} from "./@types";

type ViewAssets = {
  name: string;
  columns: ViewColumn[] | MaterializedViewColumn[];
};

export function viewsMapper(
  config: ResolvedConfig,
  schema: string,
  enums: EnumDeclaration[],
  callbacks: { onTypeImport: OnTypeImport },
) {
  const {
    viewFilter,
    viewNominator,
    modelNominator,
    viewSuffix,
    queryBuilderSuffix,
  } = config;

  return (view: ViewAssets): ViewDeclaration[] => {
    const { name } = view;

    if (!viewFilter(name, { schema })) {
      [];
    }

    const columns = columnsIterator(
      config,
      schema,
      name,
      view.columns,
      enums,
      callbacks,
    );

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
        primaryKey: columns.find((e) => e.isPrimaryKey)?.name,
        declaredName,
        recordName,
        queryBuilder,
        modelName,
        columns,
      },
    ];
  };
}
