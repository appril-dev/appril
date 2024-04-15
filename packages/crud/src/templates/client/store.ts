/// <reference path="../env.d.ts" />

import type { Pager } from "@appril/crud";
import type { UnwrapRef } from "vue";
import { defineStore } from "pinia";

import {
  type ItemT,
  type PKeyT,
  type EnvT,
  type ListAssetsT,
  type ItemAssetsT,
  primaryKey,
  modelName,
} from "./assets";

type StateT = {
  env: EnvT;
  listItems: ItemT[];
  listPager: Pager;
  listAssets: ListAssetsT | undefined;
  item: ItemT | undefined;
  itemAssets: ItemAssetsT | undefined;
  itemEvent: StoreItemEvent;
  loading: boolean;
  createDialog: boolean;
  successMessage: string | boolean;
};

type StoreItemEvent = {
  event: "Created" | "Updated" | "Deleted" | undefined;
  id: PKeyT | undefined;
};

export const useStore = defineStore(modelName, {
  state: (): StateT => {
    return {
      env: {} as EnvT,
      listItems: [],
      listPager: {
        totalItems: 0,
        totalPages: 0,
        currentPage: 0,
        nextPage: 0,
        prevPage: 0,
        offset: 0,
      },
      listAssets: undefined,
      item: undefined,
      itemAssets: undefined,
      itemEvent: { event: undefined, id: undefined },
      loading: false,
      createDialog: false,
      successMessage: false,
    };
  },

  actions: {
    setEnv(env: UnwrapRef<EnvT>) {
      this.$patch((state) => {
        state.env = env;
      });
    },

    setListItems(items: UnwrapRef<ItemT[]>) {
      this.$patch((state) => {
        state.listItems = items;
      });
    },

    setListPager(pager: Pager) {
      this.$patch((state) => {
        state.listPager = pager;
      });
    },

    setListAssets(assets: UnwrapRef<ListAssetsT>) {
      this.$patch((state) => {
        state.listAssets = assets;
      });
    },

    setItem(item: UnwrapRef<ItemT>) {
      this.$patch((state) => {
        state.item = item;
      });
    },

    setItemAssets(itemAssets: UnwrapRef<ItemAssetsT>) {
      this.$patch((state) => {
        state.itemAssets = itemAssets;
      });
    },

    insertItem(_id: PKeyT, _item: ItemT) {
      // signalling item created
    },

    patchItem(updates: Partial<UnwrapRef<ItemT>>) {
      this.$patch((state) => {
        if (state.item && updates) {
          state.item = { ...state.item, ...updates };
        }
      });
    },

    patchItemAssets(updates: UnwrapRef<ItemAssetsT>) {
      this.$patch((state) => {
        if (state.itemAssets && updates) {
          state.itemAssets = { ...(state.itemAssets || {}), ...updates };
        }
      });
    },

    updateItem(id: PKeyT, updates: Partial<UnwrapRef<ItemT>>) {
      this.$patch((state) => {
        if (state.item && updates) {
          state.item = { ...state.item, ...updates };
          for (const item of state.listItems) {
            if (String(item?.[primaryKey]) === String(id)) {
              Object.assign(item, updates);
            }
          }
        }
      });
    },

    unshiftItem(item: UnwrapRef<ItemT>) {
      this.$patch((state) => {
        state.listItems.unshift(item);
      });
    },

    async removeItem(id: PKeyT) {
      this.$patch((state) => {
        state.listItems = state.listItems.filter(
          // biome-ignore lint:
          (e: any) => String(e[primaryKey]) !== String(id),
        );
      });
    },

    toggleLoading(_s?: boolean) {
      // biome-ignore lint:
      this.loading = arguments.length ? Boolean(_s) : !this.loading;
      return this.loading;
    },
  },
});

export const actionListeners: import("pinia").StoreOnActionListener<
  typeof modelName,
  StateT,
  unknown,
  import("pinia").StoreActions<ReturnType<typeof useStore>>
>[] = [
  function ({ store, name, args, after }) {
    if (name === "setItem") {
      const [item] = args;

      const id = item?.[primaryKey];

      if (id) {
        after(() => {
          // biome-ignore lint:
          if (!store.listItems.some((e: any) => e[primaryKey] === id)) {
            store.unshiftItem(item);
          }
        });
      }
      return;
    }

    if (name === "insertItem") {
      store.itemEvent = { event: "Created", id: args[0] };
    } else if (name === "updateItem") {
      store.itemEvent = { event: "Updated", id: args[0] };
    } else if (name === "patchItem") {
      store.itemEvent = {
        event: "Updated",
        id: store.item?.[primaryKey],
      };
    } else if (name === "removeItem") {
      store.itemEvent = { event: "Deleted", id: args[0] };
    }
  },
];
