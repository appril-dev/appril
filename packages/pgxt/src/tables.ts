import type { TableColumn } from "extract-pg-schema";

import type {
  ResolvedConfig,
  TableDeclaration,
  EnumDeclaration,
} from "./types";

import { defaultTableNominator, defaultModelNominator } from "./nominators";

import { columnsIterator } from "./columns";

export function tablesMapper(
  config: ResolvedConfig,
  schema: string,
  enums: Array<EnumDeclaration>,
) {
  const {
    tableFilter,
    tableNominator,
    modelNominator,
    recordSuffix,
    insertSuffix,
    updateSuffix,
    queryBuilderSuffix,
  } = config;

  return (table: {
    name: string;
    columns: Array<TableColumn>;
  }): Array<TableDeclaration> => {
    const { name } = table;

    if (!tableFilter(name, { schema })) {
      return [];
    }

    const columns = columnsIterator(config, schema, name, table.columns, enums);

    const declaredName = tableNominator(name, {
      schema,
      defaultNominator: defaultTableNominator,
    });

    const recordName = declaredName + recordSuffix;
    const insertName = declaredName + insertSuffix;
    const updateName = declaredName + updateSuffix;
    const queryBuilder = declaredName + queryBuilderSuffix;

    const modelName = modelNominator(name, {
      schema,
      defaultNominator: defaultModelNominator,
    });

    return [
      {
        schema,
        name,
        fullName: `${schema}.${name}`,
        modelName,
        moduleName: `${schema}.${name}`,
        primaryKey: columns.find((e) => e.isPrimaryKey)?.name,
        declaredName,
        recordName,
        insertName,
        updateName,
        queryBuilder,
        columns,
        regularColumns: columns.filter((e) => e.isRegular),
      },
    ];
  };
}
