import type { ResolvedConfig, EnumDeclaration } from "./@types";

import { defaultEnumNominator } from "./nominators";

export function enumsMapper(config: ResolvedConfig, schema: string) {
  const { enumFilter, enumNominator, enumSuffix } = config;

  return (entry: {
    name: string;
    values: Array<string>;
  }): Array<EnumDeclaration> => {
    const { name, values } = entry;

    if (!enumFilter(name, { schema })) {
      return [];
    }

    const declaredName = enumNominator(name, {
      schema,
      defaultNominator: defaultEnumNominator,
    });

    return [
      {
        schema,
        name,
        declaredName,
        values,
        enumSuffix,
      },
    ];
  };
}
