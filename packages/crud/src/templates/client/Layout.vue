<script setup lang="ts">

import { ref, onBeforeMount } from "vue";
import { useRoute, onBeforeRouteUpdate } from "vue-router";
import { Success, Error as ErrorC } from "@appril/ui";

import { type ItemT, type PKeyT, primaryKey } from "./assets";
import { useStore } from "./store";
import { useHandlers } from "./handlers";

import ControlButtons from "./ControlButtons.vue";
import Pager from "./Pager.vue";
import EditorPlaceholder from "./EditorPlaceholder.vue";
import Overlay from "./Overlay.vue";

const props = defineProps<{
  fullpageEditor?: boolean | "true" | "false";
}>()

const store = useStore()
const route = useRoute()

const error = ref()

const {
  itemRoute, isActiveItem,
  loadEnv, envLoaded,
  loadItems, itemsLoaded,
  loadItem, itemLoaded,
} = useHandlers({
  errorHandler(e) {
    error.value = e
    throw e
  },
})

onBeforeMount(() => {
  loadEnv().then(envLoaded).then(() => {
    loadItems().then(itemsLoaded).then(() => {
      if (route.query._id) {
        loadItem(route.query._id as unknown as PKeyT).then(itemLoaded)
      }
    })
  })
})

onBeforeRouteUpdate((to, from) => {

  if (Number(to.query._page) !== Number(from.query._page)) {
    loadItems(to.query).then(itemsLoaded)
  }

  if (!to.query._id) {
    return
  }

  if (to.query._id !== from.query._id) {
    loadItem(to.query._id as unknown as PKeyT).then(itemLoaded)
  }

})

function itemKey(
  item: ItemT,
  prefix = "",
): string {
  return [
    prefix || "",
    item?.[primaryKey] || "",
  ].map(String).join(":")
}
</script>

<template>
  <Success v-model="store.itemEvent.event">
    {{ store.$id }} #{{ store.itemEvent.id }} Successfully
    {{ store.itemEvent.event }}
  </Success>

  <Success v-model="store.successMessage">
    {{ typeof store.successMessage === "string" ? store.successMessage : "Your changes were successful!" }}
  </Success>

  <ErrorC v-model="error" />

  <slot name="controlButtons">
    <ControlButtons>
      <slot name="createButton">
        <template slot="createButton"></template>
      </slot>

      <slot name="deleteButton">
        <template slot="deleteButton"></template>
      </slot>

      <slot name="closeButton">
        <template slot="closeButton"></template>
      </slot>
    </ControlButtons>
  </slot>

  <slot name="container">
    <div v-if="props.fullpageEditor === true || props.fullpageEditor === 'true'">
      <slot v-if="store.item" :item="store.item satisfies ItemT" :key="itemKey(store.item, 'editor')" />
      <slot v-else name="editorPlaceholder">
        <EditorPlaceholder />
      </slot>
    </div>

    <div v-else class="row">
      <div class="col-lg-3">
        <div class="d-grid gap-2">
          <slot name="filters" />

          <div>
            <slot name="pager">
              <Pager />
            </slot>
          </div>

          <slot name="listHeader" />

          <slot name="list">
            <ul class="list-group shadow-sm">
              <li v-for="item of store.listItems" :key="itemKey(item, 'list')"
                class="list-group-item list-group-item-compact" :class="{ 'list-group-item-primary': isActiveItem(item) }"
                style="position: relative; min-height: 24px;">
                <slot name="listItem" :item="item satisfies ItemT">
                  <slot name="listItemName" :item="item satisfies ItemT">
                    <slot name="listItemNamePrefix" :item="item satisfies ItemT" />
                    <slot name="listItemNameLink" :item="item satisfies ItemT">
                      <RouterLink :to="itemRoute(item)">
                        <slot name="listItemNameText" :item="item satisfies ItemT">
                          {{ "name" in item ? item.name : "" }}
                        </slot>
                      </RouterLink>
                    </slot>
                    <slot name="listItemNameSuffix" :item="item satisfies ItemT" />
                  </slot>

                  <slot name="listItemId" :item="item satisfies ItemT">
                    <div style="position: absolute; top: 0; right: 3px; font-size: .7rem;">
                      <slot name="listItemIdLink" :item="item satisfies ItemT">
                        <RouterLink :to="itemRoute(item)" class="text-muted">
                          <slot name="listItemIdText" :item="item satisfies ItemT">
                            #{{ item[primaryKey] }}
                          </slot>
                        </RouterLink>
                      </slot>
                    </div>
                  </slot>
                </slot>
              </li>
            </ul>
          </slot>

          <slot name="listFooter" />

          <hr class="d-lg-none mt-0" />
        </div>
      </div>

      <div class="col-lg-9">
        <slot v-if="store.item" name="editor" :item="store.item satisfies ItemT" :key="itemKey(store.item, 'editor')" />
        <slot v-else name="editorPlaceholder">
          <EditorPlaceholder />
        </slot>
      </div>
    </div>
  </slot>

  <slot name="overlay">
    <Overlay v-if="store.loading" />
  </slot>
</template>
