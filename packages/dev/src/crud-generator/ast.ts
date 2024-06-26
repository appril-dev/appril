import * as tsquery from "@phenomnomnominal/tsquery";
import fsx from "fs-extra";

import type { CallExpression, Expression, Node } from "typescript";

import type { ApiTypes } from "@appril/crud";
import type { TypeDeclaration } from "../@types";
import { extractTypeDeclarations, type RelpathResolver } from "../ast";

const METHODS = ["env", "list", "retrieve"] as const;

const METHODS_REGEX = new RegExp(`\\b(${METHODS.join("|")})\\b`);

type Method = (typeof METHODS)[number];

const TYPENAME_BY_METHOD: Record<Method, keyof ApiTypes> = {
  env: "EnvT",
  list: "ListAssetsT",
  retrieve: "ItemAssetsT",
};

export async function extractTypes(
  file: string,
  {
    relpathResolver,
  }: {
    relpathResolver: RelpathResolver;
  },
): Promise<
  {
    typeDeclarations: TypeDeclaration[];
  } & ApiTypes
> {
  const fileContent = (await fsx.exists(file))
    ? await fsx.readFile(file, "utf8")
    : "";

  const ast = tsquery.ast(fileContent);

  const callExpressions: CallExpression[] = tsquery.match(
    ast,
    "ExportAssignment ArrayLiteralExpression > CallExpression",
  );

  const typeDeclarations = extractTypeDeclarations(ast, { relpathResolver });
  const typeDefinitions: ApiTypes = {};

  for (const exp of callExpressions) {
    const [firstArg] = exp.arguments;

    if (!firstArg) {
      continue;
    }

    const [method] = [
      ...(exp.expression.getText().match(METHODS_REGEX) || []),
    ] as Method[];

    if (!method || !METHODS.includes(method)) {
      continue;
    }

    let typeDefinition: string | undefined;

    if (method === "env") {
      typeDefinition = getReturnType(firstArg);
    } else if (method === "list" || method === "retrieve") {
      for (const node of [
        ...tsquery
          .match(
            firstArg,
            "ObjectLiteralExpression > MethodDeclaration > Identifier[name=assets]",
          )
          .map((e) => e.parent),

        ...tsquery.match(
          firstArg,
          "ObjectLiteralExpression > PropertyAssignment > Identifier[name=assets] ~ ArrowFunction",
        ),
      ]) {
        typeDefinition = getReturnType(node);
      }
    }

    if (!typeDefinition) {
      continue;
    }

    typeDefinitions[TYPENAME_BY_METHOD[method]] = typeDefinition;
  }

  return {
    typeDeclarations,
    ...typeDefinitions,
  };
}

function getReturnType(node: Expression | Node): string | undefined {
  const [typeReference] = tsquery
    .match(node, "TypeReference,TypeLiteral,AnyKeyword")
    .filter((e) => e.parent === node);

  if (typeReference) {
    if (/^Promise(\s+)?</.test(typeReference.getText())) {
      const [wrappedType] = tsquery.match(
        typeReference,
        "TypeReference:first-child,TypeLiteral:first-child,AnyKeyword:first-child",
      );

      return wrappedType?.getText();
    }

    return typeReference.getText();
  }
}
