import type { Middleware } from "koa";

import type {
  APIMethod,
  UseDefinition,
  UseDefinitionBase,
  UseIdentities,
  UseScope,
  UseScopeGlobal,
  Middleworker,
  DefinitionI,
} from "./@types";

import store from "./store";

export { use, useGlobal };

export const head: DefinitionI = (arg) => definitionFactory("head", arg);
export const options: DefinitionI = (arg) => definitionFactory("options", arg);
export const get: DefinitionI = (arg) => definitionFactory("get", arg);
export const put: DefinitionI = (arg) => definitionFactory("put", arg);
export const patch: DefinitionI = (arg) => definitionFactory("patch", arg);
export const post: DefinitionI = (arg) => definitionFactory("post", arg);
export const del: DefinitionI = (arg) => definitionFactory("del", arg);

// use
function use(middleware: Middleware): UseDefinition;
function use(middleware: Middleware[]): UseDefinition;

function use(
  namespace: keyof UseIdentities,
  middleware: Middleware,
): UseDefinition;

function use(
  namespace: keyof UseIdentities,
  middleware: Middleware[],
): UseDefinition;

function use(...args: unknown[]) {
  return useDefinitionFactory<UseScope>(args);
}

// useGlobal
function useGlobal(middleware: Middleware): UseDefinition<UseScopeGlobal>;
function useGlobal(middleware: Middleware[]): UseDefinition<UseScopeGlobal>;

function useGlobal(
  namespace: keyof UseIdentities,
  middleware: Middleware,
): UseDefinition<UseScopeGlobal>;

function useGlobal(
  namespace: keyof UseIdentities,
  middleware: Middleware[],
): UseDefinition<UseScopeGlobal>;

function useGlobal(...args: unknown[]) {
  return useDefinitionFactory<UseScopeGlobal>(args, (e) =>
    store.useGlobal.push(e),
  );
}

// factories / builders
export function definitionFactory<StateT, ContextT>(
  method: APIMethod,
  arg: unknown,
) {
  if (typeof arg === "function") {
    return {
      method,
      middleworker: arg as Middleworker<StateT, ContextT>,
    };
  }

  if (Array.isArray(arg)) {
    return {
      method,
      middleware: arg as Middleware<StateT, ContextT>[],
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
