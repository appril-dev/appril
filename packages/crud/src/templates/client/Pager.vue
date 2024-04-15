<script setup lang="ts">

import { Icon } from "@appril/ui";

import { useStore } from "./store";
import { useHandlers } from "./handlers";

const store = useStore()
const { gotoPage } = useHandlers()
</script>

<template>
  <div class="input-group input-group-sm">
    <button type="button" @click="gotoPage(1)" class="btn btn-outline-secondary"
      :disabled="store.listPager.currentPage <= 1">
      <Icon angles-left />
    </button>

    <button type="button" @click="gotoPage(store.listPager.prevPage)" class="btn btn-outline-secondary"
      :disabled="!store.listPager.prevPage">
      <Icon angle-left /> {{ store.listPager.prevPage }}
    </button>

    <input type="text" :value="store.listPager.currentPage"
      @keyup.enter.prevent="gotoPage(($event.target as HTMLInputElement).value)" class="form-control text-center" />

    <button type="button" @click="gotoPage(store.listPager.nextPage)" class="btn btn-outline-secondary"
      :disabled="!store.listPager.nextPage">
      {{ store.listPager.nextPage }}
      <Icon angle-right />
    </button>

    <button type="button" @click="gotoPage(store.listPager.totalPages)" class="btn btn-outline-secondary"
      :disabled="store.listPager.currentPage >= store.listPager.totalPages">
      <Icon angles-right />
    </button>
  </div>

  <div class="d-flex justify-content-center">
    <small v-if="store.listPager.totalItems > 0" class="text-muted">
      {{ store.listPager.offset + 1 }}
      - {{ store.listPager.offset + store.listItems.length }} of
      {{ store.listPager.totalItems }}
    </small>
  </div>
</template>
