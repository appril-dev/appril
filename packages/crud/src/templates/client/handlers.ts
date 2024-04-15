/// <reference path="../env.d.ts" />

import { type UnwrapRef, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { type ZodTypeAny, z } from "zod";

import type { Pager } from "@appril/crud";

import { useStore } from "./store";

import {
  type ItemT,
  type ItemI,
  type ItemU,
  type PKeyT,
  type EnvT,
  type ListAssetsT,
  type ItemAssetsT,
  apiTypes,
  regularColumns,
  zodSchema as zodSchemaBuilder,
  zodErrorHandler,
  primaryKey,
} from "./assets";

import { fetchApi } from "./fetch";

type EnvResponse = UnwrapRef<EnvT | undefined>;

type IndexResponse = UnwrapRef<{
  items: ItemT[];
  pager: Pager;
  assets: ListAssetsT;
}>;

type ReadResponse = UnwrapRef<{
  item: ItemT;
  assets: ItemAssetsT;
}>;

type DefaultErrorHandler = <T = never>(e: unknown) => T;

let defaultErrorHandler: DefaultErrorHandler;

export const useHandlers = (opt?: {
  errorHandler?: DefaultErrorHandler;
}) => {
  const store = useStore();
  const router = useRouter();
  const route = useRoute();

  if (opt?.errorHandler && !defaultErrorHandler) {
    defaultErrorHandler = opt.errorHandler;
  }

  const errorHandler = opt?.errorHandler || defaultErrorHandler;

  const zodSchema = zodSchemaBuilder(z);

  const validatedDataset = (dataset: unknown) => {
    if (!zodSchema || !dataset) {
      return dataset;
    }

    const zodObject = z.object(
      Object.keys(dataset).reduce((map: Record<string, ZodTypeAny>, col) => {
        map[col] = zodSchema[col as keyof typeof zodSchema];
        return map;
      }, {}),
    );

    zodObject.parse(dataset);

    return dataset;
  };

  const handlers = {
    loadEnv(query?: Record<string, unknown>) {
      if (apiTypes?.EnvT) {
        store.toggleLoading();
        return fetchApi
          .get<EnvT>("env", query || route.query)
          .catch(errorHandler)
          .finally(() => {
            store.toggleLoading();
          });
      }

      return Promise.resolve(undefined);
    },

    envLoaded(env: EnvResponse) {
      if (env) {
        store.setEnv(env);
      }
      return env;
    },

    loadItems(query?: Record<string, unknown>) {
      store.toggleLoading();
      return fetchApi
        .get<IndexResponse>("/", query || route.query)
        .catch(errorHandler)
        .finally(() => {
          store.toggleLoading();
        });
    },

    itemsLoaded(response: IndexResponse) {
      if (response) {
        store.setListItems(response.items);
        store.setListPager(response.pager);
        store.setListAssets(response.assets);
      }
    },

    loadItem(id: PKeyT) {
      store.toggleLoading();
      return fetchApi
        .get<ReadResponse>(id)
        .catch(errorHandler)
        .finally(() => {
          store.toggleLoading();
        });
    },

    itemLoaded({ item, assets }: ReadResponse) {
      store.setItem(item);
      store.setItemAssets(assets);
      window.scrollTo(0, 0);
    },

    createItem(_dataset: ItemI) {
      let dataset: ItemI;
      try {
        dataset = validatedDataset(_dataset) as ItemI;
      } catch (error: unknown) {
        return Promise.reject(
          errorHandler(zodErrorHandler ? zodErrorHandler(error) : error),
        );
      }
      store.toggleLoading();
      return fetchApi
        .post<ItemT>(dataset)
        .catch(errorHandler)
        .finally(() => {
          store.toggleLoading();
        });
    },

    itemCreated(item: ItemT) {
      router.push(handlers.itemRoute(item)).then(() => {
        store.insertItem(item[primaryKey], item);
      });
      return item;
    },

    $updateItem(id: PKeyT, _dataset: Partial<ItemU>) {
      let dataset: ItemU;
      try {
        dataset = validatedDataset(_dataset) as ItemU;
      } catch (error: unknown) {
        return Promise.reject(
          errorHandler(zodErrorHandler ? zodErrorHandler(error) : error),
        );
      }
      store.toggleLoading();
      return fetchApi
        .patch<ItemT>(id, dataset)
        .catch(errorHandler)
        .finally(() => {
          store.toggleLoading();
        });
    },

    updateItem(dataset: Partial<ItemU>) {
      if (store.item) {
        return handlers.$updateItem(store.item[primaryKey], dataset);
      }
      return Promise.reject(errorHandler("store.item is undefined"));
    },

    itemUpdated(item: Partial<ItemT>) {
      const { [primaryKey]: id, ...updates } = item;
      store.updateItem(id as PKeyT, updates);
      return item;
    },

    $deleteItem(id: PKeyT) {
      store.toggleLoading();
      return fetchApi
        .delete<ItemT>(id)
        .catch(errorHandler)
        .finally(() => {
          store.toggleLoading();
        });
    },

    deleteItem() {
      if (store.item) {
        return handlers.$deleteItem(store.item[primaryKey]);
      }
      return Promise.reject(errorHandler("store.item is undefined"));
    },

    itemDeleted(item: ItemT) {
      const { [primaryKey]: id } = item;
      store.removeItem(id).then(handlers.closeItem).then(handlers.gotoPrevPage);
      return item;
    },

    gotoItem(item: ItemT) {
      return router.push(handlers.itemRoute(item));
    },

    closeItem() {
      store.item = undefined;
      return router.push(handlers.itemRoute());
    },

    itemRoute(item?: ItemT) {
      const _id = item?.[primaryKey] || undefined;
      return {
        ...route,
        query: {
          ...route.query,
          _id,
        },
      };
    },

    isActiveItem(item: ItemT) {
      if (!store.item) {
        return false;
      }
      const a = item?.[primaryKey];
      const b = store.item[primaryKey];
      return !a || !b ? false : String(a) === String(b);
    },

    gotoPrevPage() {
      const _page = Number(route.query._page || 0);
      return !store.listItems.length && _page > 1
        ? router.replace({ query: { ...route.query, _page: _page - 1 } })
        : Promise.resolve();
    },

    gotoPage(_page?: number | string | undefined) {
      return router.push({ query: { ...route.query, _page } });
    },
  };

  return handlers;
};

export const useFilters = function useFilters<T extends string = "">(
  params: readonly T[],
) {
  const router = useRouter();
  const route = useRoute();

  const model = ref(
    params.reduce((map: Record<string, unknown>, param) => {
      map[param] = route.query[param];
      return map;
    }, {}),
  );

  const { loadItems, itemsLoaded } = useHandlers();

  const handlers = {
    model: model.value,

    $apply() {
      return router
        .push({
          query: { ...route.query, ...(model.value || {}), _page: undefined },
        })
        .then(() => loadItems())
        .then(itemsLoaded);
    },

    apply() {
      return handlers.$apply();
    },

    $reset() {
      for (const key of Object.keys(model.value)) {
        model.value[key] = undefined;
      }
      return router
        .push({ query: { ...route.query, ...model.value, _page: undefined } })
        .then(() => loadItems())
        .then(itemsLoaded);
    },

    reset() {
      return handlers.$reset();
    },
  };

  return handlers;
};

export const useModel = function useModel(opt?: {
  columns?: (keyof ItemT)[];
  reactive?: boolean;
}) {
  const store = useStore();
  const columns: (keyof ItemT)[] = [...(opt?.columns || regularColumns)];

  const model = ref<Partial<ItemT>>(
    columns.reduce((map: Record<string, unknown>, col) => {
      map[col] = store.item?.[col];
      return map;
    }, {}),
  );

  if (opt?.reactive !== false) {
    const { updateItem, itemUpdated } = useHandlers();

    for (const col of columns) {
      watch(
        () => model.value[col],
        // without async getting issues with error handling
        async (val) => {
          const updates = await updateItem({ [col]: val });
          itemUpdated(updates as Partial<ItemT>);
        },
      );
    }
  }

  return model;
};
