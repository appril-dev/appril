import type {
  Middleware,
  APIMethod,
  UseDefinition,
  UseDefinitionBase,
  UseIdentities,
  UseScope,
  UseScopeGlobal,
  MiddlewareDefinition,
  DefinitionI,
  UseDefinitionI,
  UseDefinitionGlobalI,
} from "./@types";

import store from "./store";

export const head: DefinitionI = (arg) => definitionFactory("head", arg);
export const options: DefinitionI = (arg) => definitionFactory("options", arg);
export const get: DefinitionI = (arg) => definitionFactory("get", arg);
export const put: DefinitionI = (arg) => definitionFactory("put", arg);
export const patch: DefinitionI = (arg) => definitionFactory("patch", arg);
export const post: DefinitionI = (arg) => definitionFactory("post", arg);
export const del: DefinitionI = (arg) => definitionFactory("del", arg);

export const use: UseDefinitionI = (...args: unknown[]) => {
  return useDefinitionFactory<UseScope>(args);
};

export const useGlobal: UseDefinitionGlobalI = (...args: unknown[]) => {
  return useDefinitionFactory<UseScopeGlobal>(args, (e) => {
    return store.useGlobal.push(e);
  });
};

// factories / builders
export function definitionFactory(
  method: APIMethod,
  arg: unknown,
): MiddlewareDefinition {
  if (typeof arg === "function") {
    return {
      method,
      middleware: [
        async (ctx, next) => {
          ctx.body = await arg(ctx, ctx.payload as never);
          return next();
        },
      ],
    };
  }

  if (Array.isArray(arg)) {
    return {
      method,
      middleware: arg,
    };
  }

  throw new Error(
    "Api endpoints supposed to receive a function or an array of functions",
  );
}

function useDefinitionFactory<TScope extends UseScope | UseScopeGlobal>(
  args: unknown[],
  callback?: (d: UseDefinition<TScope>) => void,
): UseDefinition<TScope> {
  const definition = useDefinitionBuilder(args);

  let $before: TScope[] = [];
  let $after: TScope[] = [];

  const matchFactory = (apiMethod: APIMethod) => {
    return (scope: UseScope) => {
      // biome-ignore format:
      const apiMethods = typeof scope === "string"
        ? [scope]
        : Array.isArray(scope) ? scope : [];

      return apiMethods.includes(apiMethod);
    };
  };

  Object.defineProperties(definition, {
    before: {
      value: (...s: TScope[]) => {
        // do not push, rather replace! (to be able to override by later call)
        $before = s;
        return definition;
      },
    },
    beforeMatch: {
      value: (m: APIMethod) => {
        // if NO opted methods, run before ANY method!
        // if Some methods opted, run only before opted methods
        return !$before.length || $before.some(matchFactory(m));
      },
    },
    after: {
      value: (...s: TScope[]) => {
        // do not push, rather replace! (to be able to override by later call)
        $after = s;
        return definition;
      },
    },
    afterMatch: {
      value: (m: APIMethod) => {
        // if NO methods opted, do NOT run anywhere!
        // if Some methods opted, run only after opted methods;
        return $after.some(matchFactory(m));
      },
    },
  });

  callback?.(definition as UseDefinition<TScope>);

  return definition as UseDefinition<TScope>;
}

function useDefinitionBuilder(args: unknown[]): UseDefinitionBase {
  let name: keyof UseIdentities | undefined;
  let use: Middleware[] = [];

  if (args.length === 2) {
    if (typeof args[0] === "string") {
      name = args[0] as keyof UseIdentities;
    } else {
      throw new Error("First argument expected to be a string");
    }

    if (typeof args[1] === "function") {
      use = [args[1]] as Middleware[];
    } else if (Array.isArray(args[1])) {
      use = args[1];
    } else {
      throw new Error("Second argument expected to be a function");
    }
  } else if (args.length === 1) {
    if (typeof args[0] === "function") {
      use = [args[0]] as Middleware[];
    } else if (Array.isArray(args[0])) {
      use = args[0];
    } else {
      throw new Error("Second argument expected to be a function");
    }
  } else {
    throw new Error(`Expected 1-2 arguments, received ${args.length}`);
  }

  return { use, name };
}
