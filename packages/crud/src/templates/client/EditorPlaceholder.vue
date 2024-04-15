<script setup lang="ts">
import { useStore } from "./store";
const store = useStore()
</script>

<template>
  <div class="d-flex justify-content-center">
    <h2>Total Items: {{ store.listPager.totalItems }}</h2>
  </div>
</template>
