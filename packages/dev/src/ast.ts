import fsx from "fs-extra";
// TODO: consider github.com/dsherret/ts-morph
import tsquery from "@phenomnomnominal/tsquery";
import ts from "typescript";
import crc32 from "crc/crc32";
import { APIMethods, type APIMethod, type HTTPMethod } from "@appril/api";

import type { ApiRoute } from "./types";
import { httpMethodByApi } from "@appril/api/lib";

export type PayloadType = {
  id: string;
  apiMethod: APIMethod;
  httpMethod: HTTPMethod;
  text: string;
};

export type ResponseType = {
  id: string;
  apiMethod: APIMethod;
  httpMethod: HTTPMethod;
  text: string;
};

export type RouteSpecSignature = {
  apiMethod: APIMethod;
  httpMethod: HTTPMethod;
  payloadType: PayloadType | undefined;
  returnType: ResponseType | undefined;
};

export type RelpathResolver = (path: string) => string;

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

export function extractRouteSpecSignatures(
  route: ApiRoute,
  ast: ts.SourceFile,
): Array<RouteSpecSignature> {
  const [callExpression] = tsquery.match(
    ast,
    "ExportAssignment > CallExpression",
  );

  if (!callExpression) {
    return [];
  }

  const [arrayLiteralExpression] = tsquery
    .match(
      callExpression,
      [
        "ArrowFunction      > ArrayLiteralExpression",
        "FunctionExpression > ArrayLiteralExpression",
      ].join(", "),
    )
    .filter((e) => e.parent?.parent === callExpression);

  if (!arrayLiteralExpression) {
    return [];
  }

  const methodsLiteral = Object.values(APIMethods).join("|");

  let callExpressions: Array<[ts.CallExpression, APIMethod]> = tsquery
    .match(
      arrayLiteralExpression,
      `CallExpression > Identifier[name=/^(${methodsLiteral})$/]`,
    )
    .flatMap((e) =>
      e.parent?.parent === arrayLiteralExpression
        ? [[e.parent as ts.CallExpression, e.getText() as APIMethod]]
        : [],
    );

  if (!callExpressions.length) {
    callExpressions = tsquery
      .match(
        arrayLiteralExpression,
        `CallExpression > PropertyAccessExpression > Identifier[name=/^(${methodsLiteral})$/]`,
      )
      .flatMap((e) =>
        e.parent?.parent?.parent === arrayLiteralExpression
          ? [[e.parent.parent as ts.CallExpression, e.getText() as APIMethod]]
          : [],
      );
  }

  const signatures: Array<RouteSpecSignature> = [];

  for (const [callExpression, apiMethod] of callExpressions) {
    const [managedMiddlewareExpression] = tsquery
      .match(callExpression, "ArrowFunction, FunctionExpression")
      .filter((e) => e.parent === callExpression);

    const generics = extractGenerics(callExpression);

    const httpMethod = httpMethodByApi(apiMethod);

    const payloadTypeText = generics[1]
      ? extractPayloadType(generics[1])
      : undefined;

    const payloadType = payloadTypeText
      ? {
          id: ["PayloadT", crc32(route.importName + apiMethod)].join(""),
          apiMethod,
          httpMethod,
          text: payloadTypeText,
        }
      : undefined;

    const returnTypeText = generics[2]?.getText();

    const returnType = returnTypeText
      ? {
          id: ["ReturnT", crc32(route.importName + apiMethod)].join(""),
          apiMethod,
          httpMethod,
          text: returnTypeText,
        }
      : undefined;

    signatures.push({
      apiMethod,
      httpMethod,
      payloadType,
      returnType,
    });
  }

  return signatures;
}

export function extractTypeDeclarations(
  ast: ts.SourceFile,
  {
    relpathResolver,
  }: {
    relpathResolver: RelpathResolver;
  },
): Array<TypeDeclaration> {
  const importDeclarations: Array<ts.ImportDeclaration> = tsquery.match(
    ast,
    "ImportDeclaration",
  );

  const interfaceDeclarations: Array<ts.InterfaceDeclaration> = tsquery.match(
    ast,
    "InterfaceDeclaration",
  );

  const typeAliasDeclarations: Array<ts.TypeAliasDeclaration> = tsquery.match(
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
    ) as Array<ts.ImportSpecifier>) {
      const name = spec.getText();
      let text: string;
      if (node.importClause?.isTypeOnly) {
        text = `import type { ${name} } from "${path}";`;
      } else if (spec.isTypeOnly) {
        text = `import type { ${name.replace("type ", "")} } from "${path}";`;
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

export function extractParamsType(ast: ts.SourceFile): string | undefined {
  const [callExpression] = tsquery.match(
    ast,
    "ExportAssignment > CallExpression",
  );

  if (!callExpression) {
    return;
  }

  const [paramsType] = extractGenerics(callExpression);

  return paramsType?.getText();
}

// extract [ "string", "number" ] from
// export default routeFactory<string, number>(...
// or [ "{ x: number }", "{ payload: { id: number } }" ] from
// get<{ x: number }, { payload: { id: number } }>(...
export function extractGenerics(callExpression: ts.Node): Array<ts.Node> {
  const traversed: Record<number, ts.Node> = {};
  const generics: Array<ts.Node> = [];

  for (const [i, node] of callExpression.getChildren().entries()) {
    if (
      node.kind === ts.SyntaxKind.GreaterThanToken &&
      traversed[i - 1]?.kind === ts.SyntaxKind.SyntaxList &&
      traversed[i - 2]?.kind === ts.SyntaxKind.LessThanToken
    ) {
      for (const c of traversed[i - 1].getChildren()) {
        if (c.parent !== callExpression) {
          continue;
        }
        if (c.kind === ts.SyntaxKind.CommaToken) {
          continue;
        }
        generics.push(c);
      }
      break;
    }
    traversed[i] = node;
  }

  return generics;
}

// extract "{ id: number }" from "{ payload: { id: number } }"
export function extractPayloadType(node: ts.Node): string | undefined {
  // given node looks like "{ payload: { id: number } }"
  // getting first identifier with [name=payload]
  // identifier's parent is the LabeledStatement of ineterest
  const [labeledStatement] = tsquery
    .match(node, "Identifier[name=payload]")
    .map((e) => e.parent);

  // extracted labeledStatement looks like "payload: { id: number }"
  // getChildren returns an array like "[ 'payload', ':', '{ id: number }' ]"
  const payloadType = labeledStatement?.getChildren()[2];

  return payloadType?.getText();
}

export async function extractApiAssets({
  route,
  relpathResolver,
}: {
  route: ApiRoute;
  relpathResolver: RelpathResolver;
}): Promise<{
  typeDeclarations: Array<TypeDeclaration>;
  paramsType: string | undefined;
  routeSpecSignatures: Array<RouteSpecSignature>;
}> {
  const fileContent = (await fsx.exists(route.fileFullpath))
    ? await fsx.readFile(route.fileFullpath, "utf8")
    : "";

  const ast = tsquery.ast(fileContent);

  const typeDeclarations = extractTypeDeclarations(ast, { relpathResolver });
  const paramsType = extractParamsType(ast);

  const routeSpecSignatures = extractRouteSpecSignatures(route, ast);

  return {
    typeDeclarations,
    paramsType,
    routeSpecSignatures,
  };
}
