import extractor from "extract-pg-schema";
import { merge } from "lodash-es";

import type {
  ConnectionConfig,
  Config,
  ResolvedConfig,
  EnumDeclaration,
  TableDeclaration,
  ViewDeclaration,
} from "./types";

import defaultConfig from "./config";
import { enumsMapper } from "./enums";
import { tablesMapper } from "./tables";
import { viewsMapper } from "./views";

export * from "./types";

export { defaultConfig as config };

export default async (
  connection: string | ConnectionConfig,
  userConfig: Config = {},
): Promise<{
  schemas: Array<string>;
  tables: Array<TableDeclaration>;
  enums: Array<EnumDeclaration>;
  views: Array<ViewDeclaration>;
}> => {
  const config = merge({}, defaultConfig, userConfig) as ResolvedConfig;

  const extractedSchemas = await extractor.extractSchemas(connection, config);
  const flatSchemas = Object.values(extractedSchemas);

  const schemas: Array<string> = Object.keys(extractedSchemas);
  const tables: Array<TableDeclaration> = [];
  const enums: Array<EnumDeclaration> = [];
  const views: Array<ViewDeclaration> = [];

  // iterate all schemas for enums before mapping tables/views
  for (const schema of flatSchemas) {
    enums.push(...schema.enums.flatMap(enumsMapper(config, schema.name)));
  }

  for (const schema of flatSchemas) {
    tables.push(
      ...schema.tables.flatMap(tablesMapper(config, schema.name, enums)),
    );

    views.push(
      ...schema.views.flatMap(viewsMapper(config, schema.name, enums)),
    );

    views.push(
      ...schema.materializedViews.flatMap(
        viewsMapper(config, schema.name, enums),
      ),
    );
  }

  return {
    schemas: schemas.sort((a, b) => a.localeCompare(b)),
    tables: tables.sort((a, b) => a.name.localeCompare(b.name)),
    enums: enums.sort((a, b) => a.name.localeCompare(b.name)),
    views: views.sort((a, b) => a.name.localeCompare(b.name)),
  };
};
