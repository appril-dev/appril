import extractor from "extract-pg-schema";
import { merge } from "lodash-es";

import type {
  ConnectionConfig,
  Config,
  ResolvedConfig,
  EnumDeclaration,
  TableDeclaration,
  ViewDeclaration,
  TypeImport,
  OnTypeImport,
} from "./@types";

import defaultConfig from "./config";
import { enumsMapper } from "./enums";
import { tablesMapper } from "./tables";
import { viewsMapper } from "./views";

export * from "./@types";

export { defaultConfig as config };

export default async function pgts(
  connection: string | ConnectionConfig,
  optedConfig: Config = {},
): Promise<{
  schemas: string[];
  tables: TableDeclaration[];
  enums: EnumDeclaration[];
  views: ViewDeclaration[];
  typeImports: TypeImport[];
}> {
  const config = merge({}, defaultConfig, optedConfig) as ResolvedConfig;

  const extractedSchemas = await extractor.extractSchemas(connection, config);
  const flatSchemas = Object.values(extractedSchemas);

  const schemas: string[] = Object.keys(extractedSchemas);
  const tables: TableDeclaration[] = [];
  const enums: EnumDeclaration[] = [];
  const views: ViewDeclaration[] = [];
  const typeImports: TypeImport[] = [];

  const onTypeImport: OnTypeImport = (t, schema) => {
    let entry = typeImports.find((e) => e.declaredType === t.declaredType);
    if (!entry) {
      entry = {
        ...t,
        text: t.as
          ? `import { type ${t.import} as ${t.as} } from "${t.from}";`
          : `import { type ${t.import} } from "${t.from}";`,
        schemas: [schema],
      };
      typeImports.push(entry);
    }
    entry.schemas.includes(schema) || entry.schemas.push(schema);
  };

  // iterate all schemas for enums before mapping tables/views
  for (const schema of flatSchemas) {
    enums.push(...schema.enums.flatMap(enumsMapper(config, schema.name)));
  }

  for (const schema of flatSchemas) {
    tables.push(
      ...schema.tables.flatMap(
        tablesMapper(config, schema.name, enums, { onTypeImport }),
      ),
    );

    views.push(
      ...schema.views.flatMap(
        viewsMapper(config, schema.name, enums, { onTypeImport }),
      ),
    );

    views.push(
      ...schema.materializedViews.flatMap(
        viewsMapper(config, schema.name, enums, { onTypeImport }),
      ),
    );
  }

  return {
    schemas: schemas.sort((a, b) => a.localeCompare(b)),
    tables: tables.sort((a, b) => a.name.localeCompare(b.name)),
    enums: enums.sort((a, b) => a.name.localeCompare(b.name)),
    views: views.sort((a, b) => a.name.localeCompare(b.name)),
    typeImports,
  };
}
