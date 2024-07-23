import * as tsquery from "@phenomnomnominal/tsquery";
import fsx from "fs-extra";

import type {
  Node,
  NodeArray,
  Expression,
  CallExpression,
  ImportSpecifier,
  ImportDeclaration,
  ArrowFunction,
  FunctionExpression,
  TypeAliasDeclaration,
  InterfaceDeclaration,
  ParameterDeclaration,
} from "typescript";

import ts from "typescript";

export type MiddleworkerPayloadTypes = Record<number, string>;

export type RelpathResolver = (path: string) => string;

export type FetchDefinition = {
  method: string;
  httpMethod: string;
  payloadType?: string;
  bodyType?: string;
};

export type TypeDeclaration = {
  text: string;
  importDeclaration?: {
    name: string;
    path: string;
  };
  typeAliasDeclaration?: {
    name: string;
    text: string;
  };
  interfaceDeclaration?: {
    name: string;
    text: string;
  };
};

export async function extractApiAssets(
  file: string,
  {
    relpathResolver,
  }: {
    relpathResolver: RelpathResolver;
  },
): Promise<{
  typeDeclarations: TypeDeclaration[];
  middleworkerPayloadTypes: MiddleworkerPayloadTypes;
  fetchDefinitions: FetchDefinition[];
}> {
  const fileContent = (await fsx.exists(file))
    ? await fsx.readFile(file, "utf8")
    : "";

  const ast = tsquery.ast(fileContent);

  const typeDeclarations = extractTypeDeclarations(ast, { relpathResolver });

  const callExpressions = tsquery
    .match(ast, "ExportAssignment ArrayLiteralExpression > CallExpression")
    .filter((e) => e.parent?.parent?.parent === ast) as CallExpression[];

  const middleworkerPayloadTypes: MiddleworkerPayloadTypes = {};
  const fetchDefinitions: Record<string, FetchDefinition> = {};

  for (const [i, node] of callExpressions.entries()) {
    const method = node.expression.getText();
    const httpMethod = httpMethodByApi(method);

    if (
      !["head", "options", "get", "put", "patch", "post", "del"].includes(
        method,
      )
    ) {
      continue;
    }

    const middleworker = node.arguments?.[0] as
      | ArrowFunction
      | FunctionExpression
      | undefined;

    if (
      !middleworker ||
      ![
        ts.isArrowFunction(middleworker),
        ts.isFunctionExpression(middleworker),
      ].some((e) => e === true)
    ) {
      continue;
    }

    const { payloadType } = paramsMapper(middleworker.parameters);

    if (payloadType) {
      middleworkerPayloadTypes[i] = payloadType;
    }

    fetchDefinitions[method] = {
      method,
      httpMethod,
      payloadType,
      bodyType: extractReturnType(middleworker),
    };
  }

  return {
    typeDeclarations,
    middleworkerPayloadTypes,
    fetchDefinitions: Object.values(fetchDefinitions),
  };
}

export function extractTypeDeclarations(
  ast: ReturnType<(typeof tsquery)["ast"]>,
  {
    relpathResolver,
  }: {
    relpathResolver: RelpathResolver;
  },
): TypeDeclaration[] {
  const importDeclarations: ImportDeclaration[] = tsquery.match(
    ast,
    "ImportDeclaration",
  );

  const interfaceDeclarations: InterfaceDeclaration[] = tsquery.match(
    ast,
    "InterfaceDeclaration",
  );

  const typeAliasDeclarations: TypeAliasDeclaration[] = tsquery.match(
    ast,
    "TypeAliasDeclaration",
  );

  const typeDeclarationsMap: Record<string, TypeDeclaration> = {};

  for (const node of [...importDeclarations]) {
    let path = JSON.parse(node.moduleSpecifier.getText());

    if (/^\.\.?\/?/.test(path)) {
      path = relpathResolver(path);
    }

    for (const spec of tsquery.match(
      node,
      "ImportSpecifier",
    ) as ImportSpecifier[]) {
      const name = spec.getText();
      let text: string;
      if (node.importClause?.isTypeOnly) {
        text = `import type { ${name} } from "${path}";`;
      } else if (spec.isTypeOnly) {
        text = `import { ${name} } from "${path}";`;
      } else {
        continue;
      }
      typeDeclarationsMap[text] = { text, importDeclaration: { name, path } };
    }
  }

  for (const node of interfaceDeclarations) {
    const props = tsquery
      .match(node, "PropertySignature")
      .filter((e) => e.parent === node);

    const text = node.getText();

    typeDeclarationsMap[text] = {
      text,
      interfaceDeclaration: {
        name: node.name.getText(),
        text: `{ ${props.map((e) => e.getText()).join("\n")} }`,
      },
    };
  }

  for (const node of typeAliasDeclarations) {
    const props = tsquery
      .match(node, "TypeReference,IntersectionType")
      .filter((e) => e.parent === node);

    const text = node.getText();

    typeDeclarationsMap[text] = {
      text,
      typeAliasDeclaration: {
        name: node.name.getText(),
        text: props.map((e) => e.getText()).join("\n"),
      },
    };
  }

  return Object.values(typeDeclarationsMap);
}

function paramsMapper(parameters: NodeArray<ParameterDeclaration>): {
  payloadType?: string;
} {
  let payloadType: string | undefined;

  for (const [i, parameter] of parameters.entries()) {
    if (i === 1) {
      // processing payload parameter at position 1
      const [typeExp] = tsquery
        .match(
          parameter,
          "IntersectionType,TypeReference,TypeLiteral,AnyKeyword",
        )
        .filter((e) => e.parent === parameter);

      payloadType = typeExp?.getText();
    }
  }

  return {
    payloadType,
  };
}

function extractReturnType(node: Expression | Node): string | undefined {
  const [typeExp] = tsquery
    .match(node, "IntersectionType,TypeReference,TypeLiteral,AnyKeyword")
    .filter((e) => e.parent === node);

  if (!typeExp) {
    return;
  }

  if (/^Promise(\s+)?</.test(typeExp.getText())) {
    const [wrappedType] = tsquery.match(
      typeExp,
      [
        "IntersectionType:first-child",
        "TypeReference:first-child",
        "TypeLiteral:first-child",
        "AnyKeyword:first-child",
      ].join(","),
    );

    return wrappedType?.getText();
  }

  return typeExp.getText();
}

export function httpMethodByApi(apiMethod: string): string {
  return apiMethod === "del" ? "DELETE" : apiMethod.toUpperCase();
}
