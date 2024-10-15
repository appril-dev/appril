import fsx from "fs-extra";
import tsquery from "@phenomnomnominal/tsquery";

import ts from "typescript";
import { httpMethodByApi } from "./base";

export type FetchDefinition = {
  method: string;
  httpMethod: string;
  payloadType?: string;
  bodyType?: string;
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

export function extractDefaultExportedArrayMethods<
  MethodsOfInterest extends readonly string[] = [],
>(
  srcText: string,
  {
    methodsOfInterest,
    relpathResolver,
  }: {
    methodsOfInterest: readonly string[];
    relpathResolver: RelpathResolver;
  },
): {
  typeDeclarations: Array<TypeDeclaration>;
  methods: Array<{
    method: MethodsOfInterest[number];
    payloadType: string | undefined;
    returnType: string | undefined;
  }>;
} {
  const ast = tsquery.ast(srcText);

  const typeDeclarations = extractTypeDeclarations(ast, { relpathResolver });

  const callExpressions = tsquery
    .match(ast, "ExportAssignment ArrayLiteralExpression > CallExpression")
    .filter(
      (e) => e.parent?.parent?.parent === ast,
    ) as Array<ts.CallExpression>;

  const methods = [];

  for (const node of callExpressions) {
    const method = node.expression.getText();

    if (!methodsOfInterest.includes(method)) {
      continue;
    }

    const firstArg = node.arguments?.[0] as
      | ts.ArrowFunction
      | ts.FunctionExpression
      | undefined;

    if (
      !firstArg ||
      ![ts.isArrowFunction(firstArg), ts.isFunctionExpression(firstArg)].some(
        (e) => e === true,
      )
    ) {
      continue;
    }

    const payloadType = extractPayloadType(firstArg.parameters);

    const returnType = extractReturnType(firstArg);

    methods.push({
      method,
      payloadType,
      returnType,
    });
  }

  return { typeDeclarations, methods };
}

export function extractTypeDeclarations(
  ast: ReturnType<(typeof tsquery)["ast"]>,
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

export function extractPayloadType(
  parameters: ts.NodeArray<ts.ParameterDeclaration>,
): string | undefined {
  // payload provided as second argument
  const payloadParameter = parameters[1];

  if (!payloadParameter) {
    return;
  }

  const [typeNode] = tsquery
    .match(
      payloadParameter,
      "IntersectionType,TypeReference,TypeLiteral,AnyKeyword",
    )
    .filter((e) => e.parent === payloadParameter);

  return typeNode?.getText();
}

export function extractReturnType(
  node: ts.Expression | ts.Node,
): string | undefined {
  let [typeNode] = tsquery
    .match(node, "IntersectionType,TypeReference,TypeLiteral,AnyKeyword")
    .filter((e) => e.parent === node);

  if (!typeNode) {
    return;
  }

  if (/^Promise(\s+)?</.test(typeNode.getText())) {
    const [wrappedType] = tsquery.match(
      typeNode,
      [
        "IntersectionType:first-child",
        "TypeReference:first-child",
        "TypeLiteral:first-child",
        "AnyKeyword:first-child",
      ].join(","),
    );

    typeNode = wrappedType;
  }

  return typeNode?.getText();
}

export function extractTypeReferences(node: ts.Node) {
  return tsquery
    .match<ts.TypeReferenceNode>(node, "TypeReference")
    .map((e) => e.typeName.getText());
}

export async function extractApiAssets(
  file: string,
  {
    relpathResolver,
  }: {
    relpathResolver: RelpathResolver;
  },
): Promise<{
  typeDeclarations: Array<TypeDeclaration>;
  payloadTypes: Record<string, string>;
  fetchDefinitions: Array<FetchDefinition>;
}> {
  const fileContent = (await fsx.exists(file))
    ? await fsx.readFile(file, "utf8")
    : "";

  const { typeDeclarations, methods } = extractDefaultExportedArrayMethods(
    fileContent,
    {
      relpathResolver,
      methodsOfInterest: [
        "head",
        "options",
        "get",
        "put",
        "patch",
        "post",
        "del",
      ],
    },
  );

  const payloadTypes: Record<string, string> = {};
  const fetchDefinitions: Record<string, FetchDefinition> = {};

  for (const { method, payloadType, returnType } of methods) {
    if (payloadType) {
      payloadTypes[method] = payloadType;
    }

    fetchDefinitions[method] = {
      method,
      httpMethod: httpMethodByApi(method),
      payloadType,
      bodyType: returnType,
    };
  }

  return {
    typeDeclarations,
    payloadTypes,
    fetchDefinitions: Object.values(fetchDefinitions),
  };
}
