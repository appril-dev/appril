import type {
  MaterializedViewColumn,
  TableColumn,
  ViewColumn,
} from "extract-pg-schema";

import type {
  ResolvedConfig,
  CustomType,
  ExplicitType,
  EnumDeclaration,
  ColumnDeclaration,
  ZodColumn,
  ImportedType,
} from "./types";

import { defaultTypeMap, defaultZodTypeMap } from "./default-type-maps";

export function columnsIterator(
  config: ResolvedConfig,
  schema: string,
  name: string,
  columns:
    | Array<TableColumn>
    | Array<ViewColumn>
    | Array<MaterializedViewColumn>,
  enums: Array<EnumDeclaration>,
): Array<ColumnDeclaration> {
  const columnDeclarations: Array<ColumnDeclaration> = [];

  columnDeclarations.push(
    ...columns.flatMap(columnsMapper(config, schema, name, enums)),
  );

  return columnDeclarations;
}

function columnsMapper(
  config: ResolvedConfig,
  schema: string,
  name: string,
  enums: Array<EnumDeclaration>,
) {
  const { customTypes, zod: zodConfig } = config;
  const fullName = [schema, name].join(".");

  const zodTypeMap = {
    ...defaultZodTypeMap,
    ...(zodConfig as Record<string, string>),
  };

  const tableCustomTypes: Record<string, CustomType> =
    typeof customTypes[fullName] === "object"
      ? { ...(customTypes[fullName] as object) }
      : {};

  return (
    entry: TableColumn | ViewColumn | MaterializedViewColumn,
  ): Array<ColumnDeclaration> => {
    const {
      name,
      isPrimaryKey,
      isIdentity,
      defaultValue,
      generated,
      maxLength,
      comment,
      ...column
    } = entry;

    const { fullName: type, kind } = column.type;

    let { isArray, isNullable } = column;
    let isGenerated = false;

    let declaredType = "unknown";
    let importedType: ImportedType | undefined;
    let explicitType = false;
    let enumDeclaration: EnumDeclaration | undefined;

    const comments: Array<string> = [];

    // order does matter!
    // - check enums
    // - check default mappings
    // - check customTypes
    // - check tableCustomTypes

    if (kind === "enum") {
      // enum name should be extracted from fullName
      const [schema, name] = type.split(".");

      enumDeclaration = enums.find(
        (e) => e.name === name && e.schema === schema,
      );

      if (enumDeclaration) {
        declaredType = enumDeclaration.declaredName;
      }
    }

    if (defaultTypeMap[type]) {
      declaredType = defaultTypeMap[type];
    }

    for (const customDef of [
      customTypes[type],
      tableCustomTypes[name],
    ] satisfies (CustomType | Record<string, CustomType>)[]) {
      if (!customDef) {
        continue;
      }

      if (typeof customDef === "string") {
        declaredType = customDef as string;
      } else if ((customDef as ImportedType).import) {
        importedType = customDef as ImportedType;
        declaredType = `import("${importedType.from}").${importedType.import}`;
        if (importedType.isArray) {
          isArray = true;
        }
        if (importedType.isNullable) {
          isNullable = true;
        }
      } else if ((customDef as ExplicitType).as) {
        declaredType = (customDef as ExplicitType).as;
        explicitType = true;
      }
    }

    if (isPrimaryKey) {
      comments.push("PrimaryKey");
    }

    if (defaultValue) {
      comments.push(`Default Value: ${defaultValue}`);
    }

    if (declaredType === "unknown") {
      comments.push(`Unknown Type: ${type}`);
    }

    if (generated !== "NEVER") {
      isGenerated = true;
      comments.push(`Generated: ${generated}`);
      comments.push(`${name}: ${declaredType};`);
    }

    if (!explicitType) {
      if (isArray) {
        declaredType = `Array<${declaredType}>`;
      }

      if (isNullable) {
        declaredType += " | null";
      }
    }

    if (comment) {
      comments.push(comment);
    }

    const isOptional = isNullable || isIdentity || defaultValue;

    let zodSchema: string | undefined;

    if (zodConfig && zodConfig?.[fullName] !== false && !isGenerated) {
      zodSchema = zodTypeMap[type] || "z.any()";

      const zodColumns = {
        ...(zodConfig?.[fullName] as Record<string, ZodColumn>),
      };

      if (
        typeof zodColumns[name] === "string" ||
        name in zodColumns === false
      ) {
        // order does matter!

        if (maxLength) {
          zodSchema += `.max(${maxLength})`;
        }

        if (isNullable) {
          zodSchema += ".nullable()";
        }

        // array should always go last
        if (isArray) {
          zodSchema += ".array()";
        }

        if (isOptional) {
          // .optional().array() does not ssem to work with undefined values
          zodSchema = `z.optional(${zodSchema})`;
        }

        if (zodColumns[name]) {
          zodSchema = `((z) => ${zodColumns[name]})(${zodSchema})`;
        }
      } else if (typeof zodColumns[name] === "function") {
        zodSchema = `(${zodColumns[name].toString()})(z)`;
      }
    }

    return [
      {
        type,
        kind,
        name,
        isPrimaryKey,
        isOptional,
        isGenerated,
        isRegular: !(isPrimaryKey || isGenerated),
        defaultValue,
        declaredType,
        importedType,
        comments,
        zodSchema,
        enumDeclaration,
      },
    ];
  };
}
