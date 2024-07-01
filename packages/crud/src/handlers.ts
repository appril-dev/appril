import type {
  DefaultState,
  DefaultContext,
  ParameterizedContext,
  Middleware,
} from "koa";

import Router from "@koa/router";
import { bodyparser } from "@appril/router/bodyparser";
import type { Knex } from "knex";
import type { Instance, QueryBuilder } from "@appril/dbx";

import { type ZodTypeAny, type ZodRawShape, type ZodError, z } from "zod";
import { fromZodError } from "zod-validation-error";

import type { Pager } from "./@types";

type Dataset = Record<string, unknown>;
type GenericObject = Record<string, unknown>;

type MaybePromise<T> = Promise<T> | T;

type DefaultHandler<CtxT, ReturnT> = (ctx: CtxT) => MaybePromise<ReturnT>;

type CustomHandler<CtxT, ReturnT> = (
  ctx: CtxT,
  opt: { defaultHandler: DefaultHandler<CtxT, ReturnT> },
) => MaybePromise<ReturnT>;

type ZodSchema = Record<string, ZodTypeAny>;
type ZodErrorHandler = (e: ZodError) => string;

import { config } from "./config";

const defaultZodErrorHandler: ZodErrorHandler = (e) => {
  return fromZodError(e, {
    prefix: null,
    issueSeparator: ";\n",
  }).toString();
};

export function handlersFactory<
  TableName extends Knex.TableNames,
  ItemT,
  ItemI,
  ItemU,
  PKeyT,
>(
  dbx: Instance<TableName>,
  opt: {
    primaryKey: keyof ItemT;
    columns: (keyof ItemT)[];
    itemsPerPage?: number;
    sidePages?: number;
    zodSchema?: (_z: typeof z) => ZodSchema;
    zodErrorHandler?: ZodErrorHandler;
  },
) {
  type CrudContext<Extend = unknown> = {
    readonly dbx: QueryBuilder<TableName>;
    readonly primaryKey: keyof ItemT;
    readonly columns: (keyof ItemT)[];
    returning?: (keyof ItemT)[];
    returningExclude?: (keyof ItemT)[];
    returningLiteral: (keyof ItemT)[] | "*";
  } & Extend;

  type Context<Extend = unknown> = DefaultContext & {
    readonly crud: CrudContext<Extend>;
  };

  const { primaryKey, columns, itemsPerPage, sidePages } = {
    ...config,
    ...opt,
  };

  const router = new Router();

  router.use(...(bodyparser.json() as Array<Middleware>));

  const returningLiteral = function (this: CrudContext) {
    if (this.returning) {
      return [primaryKey, ...this.returning.filter((e) => e !== primaryKey)];
    }

    if (this.returningExclude) {
      return [
        primaryKey,
        ...columns.filter(
          (e) => e !== primaryKey && !this.returningExclude?.includes(e),
        ),
      ];
    }

    return "*";
  };

  const validatedDataset = function (
    this: CrudContext<{
      dataset: Dataset;
      zodSchema: ZodSchema;
      zodErrorHandler: ZodErrorHandler;
    }>,
  ) {
    if (!this.dataset) {
      return;
    }

    const zodSchema = this.zodSchema || opt.zodSchema?.(z);

    if (!zodSchema) {
      return this.dataset;
    }

    const zodObject = z.object(
      Object.keys(this.dataset).reduce((map: ZodRawShape, col) => {
        map[col] = zodSchema[col];
        return map;
      }, {}),
    );

    try {
      zodObject.parse(this.dataset);
      // biome-ignore lint:
    } catch (error: any) {
      throw (
        this.zodErrorHandler ||
        opt.zodErrorHandler ||
        defaultZodErrorHandler
      )(error);
    }

    return this.dataset;
  };

  const ctxExtend: {
    crud: CrudContext;
  } = {
    crud: Object.defineProperties({} as CrudContext, {
      dbx: {
        get() {
          return dbx;
        },
        configurable: false,
      },
      primaryKey: {
        get() {
          return primaryKey;
        },
        configurable: false,
      },
      columns: {
        get() {
          return [...opt.columns];
        },
        configurable: false,
      },
      returningLiteral: { get: returningLiteral, configurable: false },
      validatedDataset: { get: validatedDataset, configurable: false },
    }),
  };

  const initHandler: Middleware = (ctx, next) => {
    for (const [key, value] of Object.entries(ctxExtend)) {
      key in ctx ||
        Object.defineProperty(ctx, key, {
          value,
          configurable: false,
          writable: false,
          enumerable: true,
        });
    }

    return next();
  };

  function envHandlerFactory() {
    function envHandler<
      ReturnT extends GenericObject = Record<string, unknown>,
    >(
      handler: DefaultHandler<
        ParameterizedContext<DefaultState, Context>,
        ReturnT
      >,
    ) {
      return router.get<DefaultState, Context>(
        "/env",
        initHandler,
        async (ctx, next) => {
          ctx.body = await handler(ctx);
          return next();
        },
      );
    }

    return envHandler;
  }

  function returningHandlerFactory() {
    function returningHandler(
      handler: DefaultHandler<
        ParameterizedContext<DefaultState, Context>,
        CrudContext["returning"]
      >,
    ) {
      return router.use(initHandler).use(async (ctx, next) => {
        // @ts-expect-error
        ctx.crud.returning = await handler(ctx);
        return next();
      });
    }

    return returningHandler;
  }

  function returningExcludeHandlerFactory() {
    function returningExcludeHandler(
      handler: DefaultHandler<
        ParameterizedContext<DefaultState, Context>,
        CrudContext["returningExclude"]
      >,
    ) {
      return router.use(initHandler).use(async (ctx, next) => {
        // @ts-expect-error
        ctx.crud.returningExclude = await handler(ctx);
        return next();
      });
    }

    return returningExcludeHandler;
  }

  function createHandlerFactory() {
    type ContextT = Context<{
      dataset: Dataset;
      validatedDataset: Dataset;
      zodSchema?: ZodSchema;
      zodErrorHandler?: ZodErrorHandler;
    }>;

    type CtxT = ParameterizedContext<DefaultState, ContextT>;

    type ReturnT = ItemT | undefined;

    type CustomSetup = {
      dataset?: (ctx: CtxT) => MaybePromise<ItemI>;
      datasetExtend?: (ctx: CtxT) => MaybePromise<Partial<ItemI> | undefined>;
      zodSchema?: (ctx: CtxT) => MaybePromise<ZodSchema>;
      zodErrorHandler?: (ctx: CtxT) => MaybePromise<ZodErrorHandler>;
    };

    const defaultHandler: DefaultHandler<CtxT, ReturnT> = async (
      ctx: CtxT,
    ): Promise<ReturnT> => {
      const { crud } = ctx;

      const [item] = await crud.dbx
        .insert(crud.validatedDataset as never)
        .returning(crud.returningLiteral as []);

      return item as ReturnT;
    };

    let customSetup: CustomSetup;
    let customHandler: CustomHandler<CtxT, ReturnT>;

    router.post<DefaultState, ContextT>(
      "/",
      initHandler,

      async (ctx, next) => {
        ctx.crud.dataset = {
          ...((await customSetup?.dataset?.(ctx)) ||
            (ctx.request.body as Dataset)),
          ...(await customSetup?.datasetExtend?.(ctx)),
        };

        ctx.crud.zodSchema = await customSetup?.zodSchema?.(ctx);

        ctx.crud.zodErrorHandler = await customSetup?.zodErrorHandler?.(ctx);

        ctx.body = customHandler
          ? await customHandler(ctx, { defaultHandler })
          : await defaultHandler(ctx);

        return next();
      },
    );

    return (arg?: CustomSetup | CustomHandler<CtxT, ReturnT>) => {
      if (typeof arg === "function") {
        customHandler = arg as typeof customHandler;
      } else {
        customSetup = arg as typeof customSetup;
      }
    };
  }

  function readHandlerFactory() {
    type ContextT = Context<{
      _id: PKeyT;
      queryBuilder: QueryBuilder<TableName>;
    }>;

    type CtxT = ParameterizedContext<DefaultState, ContextT>;

    type ReturnT = ItemT | undefined;

    type CustomSetup = {
      // used for filters, sorting etc.
      queryHandler?: (
        ctx: CtxT,
        query: QueryBuilder<TableName>,
      ) => MaybePromise<void>;
      // used to fetch additional item-related data
      assets?: (ctx: CtxT, item: ItemT) => MaybePromise<GenericObject>;
    };

    const defaultHandler: DefaultHandler<CtxT, ReturnT> = async (
      ctx: CtxT,
    ): Promise<ReturnT> => {
      const { crud } = ctx;

      const item = await crud.queryBuilder
        .where(crud.primaryKey as string, ctx.params._id)
        .first(crud.returningLiteral as []);

      ctx.assert(item, 404);

      return item as ReturnT;
    };

    let customSetup: CustomSetup;
    let customHandler: CustomHandler<CtxT, ReturnT>;

    router.get<DefaultState, ContextT>(
      "/:_id",
      initHandler,

      (ctx, next) => {
        ctx.crud._id = ctx.params._id as PKeyT;
        return next();
      },

      async (ctx, next) => {
        ctx.crud.queryBuilder = ctx.crud.dbx.clone();

        await customSetup?.queryHandler?.(ctx, ctx.crud.queryBuilder);

        const item = customHandler
          ? await customHandler(ctx, { defaultHandler })
          : await defaultHandler(ctx);

        if (!item) {
          return;
        }

        ctx.body = {
          item,
          assets: await customSetup?.assets?.(ctx, item),
        };

        return next();
      },
    );

    return (arg?: CustomSetup | CustomHandler<CtxT, ReturnT>) => {
      if (typeof arg === "function") {
        customHandler = arg as typeof customHandler;
      } else {
        customSetup = arg as typeof customSetup;
      }
    };
  }

  function updateHandlerFactory() {
    type ContextT = Context<{
      _id: PKeyT;
      dataset: Dataset;
      validatedDataset: Dataset;
      zodSchema?: ZodSchema;
      zodErrorHandler?: ZodErrorHandler;
    }>;

    type CtxT = ParameterizedContext<DefaultState, ContextT>;

    type ReturnT = ItemT | undefined;

    type CustomSetup = {
      dataset?: (ctx: CtxT) => MaybePromise<ItemU>;
      datasetExtend?: (ctx: CtxT) => MaybePromise<Partial<ItemU> | undefined>;
      zodSchema?: (ctx: CtxT) => MaybePromise<ZodSchema>;
      zodErrorHandler?: (ctx: CtxT) => MaybePromise<ZodErrorHandler>;
    };

    const defaultHandler: DefaultHandler<CtxT, ReturnT> = async (
      ctx: CtxT,
    ): Promise<ReturnT> => {
      const { crud } = ctx;

      const [item] = await crud.dbx
        .where(crud.primaryKey as string, ctx.params._id)
        .update(crud.validatedDataset as never)
        .returning(crud.returningLiteral as []);

      return item as ReturnT;
    };

    let customSetup: CustomSetup;
    let customHandler: CustomHandler<CtxT, ReturnT>;

    router.patch<DefaultState, ContextT>(
      "/:_id",
      initHandler,

      (ctx, next) => {
        ctx.crud._id = ctx.params._id as PKeyT;
        return next();
      },

      async (ctx, next) => {
        ctx.crud.dataset = {
          ...((await customSetup?.dataset?.(ctx)) ||
            (ctx.request.body as Dataset)),
          ...(await customSetup?.datasetExtend?.(ctx)),
        };

        ctx.crud.zodSchema = await customSetup?.zodSchema?.(ctx);

        ctx.crud.zodErrorHandler = await customSetup?.zodErrorHandler?.(ctx);

        ctx.body = customHandler
          ? await customHandler(ctx, { defaultHandler })
          : await defaultHandler(ctx);

        return next();
      },
    );

    return (arg?: CustomSetup | CustomHandler<CtxT, ReturnT>) => {
      if (typeof arg === "function") {
        customHandler = arg as typeof customHandler;
      } else {
        customSetup = arg as typeof customSetup;
      }
    };
  }

  function deleteHandlerFactory() {
    type ContextT = Context<{
      _id: PKeyT;
    }>;

    type CtxT = ParameterizedContext<DefaultState, ContextT>;

    type ReturnT = ItemT | undefined;

    const defaultHandler: DefaultHandler<CtxT, ReturnT> = async (
      ctx: CtxT,
    ): Promise<ReturnT> => {
      const { crud } = ctx;

      const [item] = await crud.dbx
        .where(crud.primaryKey as string, ctx.params._id)
        .delete()
        .returning(crud.returningLiteral as []);

      return item as ReturnT;
    };

    let customHandler: CustomHandler<CtxT, ReturnT>;

    router.del<DefaultState, ContextT>(
      "/:_id",
      initHandler,

      (ctx, next) => {
        ctx.crud._id = ctx.params._id as PKeyT;
        return next();
      },

      async (ctx, next) => {
        ctx.body = customHandler
          ? await customHandler(ctx, { defaultHandler })
          : await defaultHandler(ctx);

        return next();
      },
    );

    return (arg: CustomHandler<CtxT, ReturnT>) => {
      customHandler = arg;
    };
  }

  function indexHandlerFactory() {
    type ContextT = Context<{
      queryBuilder: QueryBuilder<TableName>;
      itemsPerPage: number;
      sidePages: number;
    }>;

    type CtxT = ParameterizedContext<DefaultState, ContextT>;

    type ReturnT = {
      items: ItemT[];
      pager: Pager;
    };

    type CustomSetup = {
      // used for filters, sorting etc.
      queryHandler?: (
        ctx: CtxT,
        query: QueryBuilder<TableName>,
      ) => MaybePromise<void>;
      // used to fetch additional items-related data
      assets?: (ctx: CtxT, items: ItemT[]) => MaybePromise<GenericObject>;
      itemsPerPage?: (ctx: CtxT) => MaybePromise<number>;
      sidePages?: (ctx: CtxT) => MaybePromise<number>;
    };

    const defaultHandler: DefaultHandler<CtxT, ReturnT> = async (
      ctx: CtxT,
    ): Promise<ReturnT> => {
      const { crud } = ctx;

      const totalItems = await crud.queryBuilder.clone().countRows();
      const totalPages = Math.ceil(totalItems / crud.itemsPerPage);

      let currentPage = Number(ctx.query._page || 0);

      if (currentPage < 1) {
        currentPage = 1;
      }

      if (currentPage > totalPages) {
        currentPage = totalPages;
      }

      let nextPage = currentPage + 1;

      if (nextPage > totalPages) {
        nextPage = 0;
      }

      let prevPage = currentPage - 1;

      if (prevPage < 1) {
        prevPage = 0;
      }

      let minPage = currentPage - crud.sidePages;

      if (currentPage + crud.sidePages > totalPages) {
        minPage = totalPages - crud.sidePages * 2;
      }

      if (minPage < 1) {
        minPage = 1;
      }

      let maxPage = currentPage + crud.sidePages;

      if (currentPage < crud.sidePages) {
        maxPage = crud.sidePages * 2;
      }

      if (maxPage > totalPages) {
        maxPage = totalPages;
      }

      let offset = (currentPage - 1) * crud.itemsPerPage;

      if (offset < 0) {
        offset = 0;
      }

      const pager = {
        totalItems,
        totalPages,
        currentPage,
        nextPage,
        prevPage,
        offset,
      } as Pager;

      const items = (await crud.queryBuilder
        .select(crud.returningLiteral)
        .offset(offset)
        .limit(crud.itemsPerPage)) as ItemT[];

      return {
        items,
        pager,
      };
    };

    let customSetup: CustomSetup;
    let customHandler: CustomHandler<CtxT, ReturnT>;

    router.get<DefaultState, ContextT>(
      "/",
      initHandler,

      async (ctx, next) => {
        ctx.crud.queryBuilder = ctx.crud.dbx.clone();

        await customSetup?.queryHandler?.(ctx, ctx.crud.queryBuilder);

        ctx.crud.itemsPerPage =
          (await customSetup?.itemsPerPage?.(ctx)) || itemsPerPage;
        ctx.crud.sidePages = (await customSetup?.sidePages?.(ctx)) || sidePages;

        const { items, pager } = customHandler
          ? await customHandler(ctx, { defaultHandler })
          : await defaultHandler(ctx);

        ctx.body = {
          items,
          pager,
          assets: await customSetup?.assets?.(ctx, items),
        };

        return next();
      },
    );

    return (arg?: CustomSetup | CustomHandler<CtxT, ReturnT>) => {
      if (typeof arg === "function") {
        customHandler = arg as typeof customHandler;
      } else {
        customSetup = arg as typeof customSetup;
      }
    };
  }

  const handlers = {
    // these handlers added to router automatically,
    // then can be configured via setup function returned by factory
    create: createHandlerFactory(),
    read: readHandlerFactory(),
    update: updateHandlerFactory(),
    delete: deleteHandlerFactory(),
    index: indexHandlerFactory(),
    // these ones added to router only when setup function called
    env: envHandlerFactory(),
    returning: returningHandlerFactory(),
    returningExclude: returningExcludeHandlerFactory(),
  };

  return (fn?: (m: typeof handlers) => void) => {
    fn?.(handlers);
    return { router };
  };
}
