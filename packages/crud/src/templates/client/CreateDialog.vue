<script setup lang="ts">

import { Modal, AwaitableIcon } from "@appril/ui";

import type { ItemT, ItemI } from "./assets";

import { useStore } from "./store";
import { useHandlers } from "./handlers";

const store = useStore()
const model = defineModel<ItemI>()

const emit = defineEmits<{
  mounted: [];
  created: [item: ItemT];
  close: [];
}>()

const { createItem, itemCreated } = useHandlers()

function create() {
  return createItem(model.value as ItemI)
    .then(itemCreated)
    .then((item) => emit("created", item))
    .then(close)
}

function close() {
  emit("close")
  store.createDialog = false
}
</script>

<template>
  <Modal @mounted="$emit('mounted')" @close="close">
    <template #header.fw-semibold.fst-italic>
      <slot name="header" :create="create"> New {{ store.$id }} </slot>
    </template>

    <template #body.d-grid.gap-3>
      <slot :create="create" />
    </template>

    <template #footer>
      <slot name="footer" :create="create">
        <button type="button" @click="create" class="btn btn-primary">
          <AwaitableIcon plus v-model="store.loading" />
          Create
        </button>
      </slot>
    </template>
  </Modal>
</template>
