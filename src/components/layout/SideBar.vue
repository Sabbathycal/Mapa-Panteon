<script setup>
import InfoSidebar from './InfoSidebar.vue'
</script>

<template>
  <aside class="sidebar">
    <InfoSidebar />
  </aside>
</template>

<style scoped>
.sidebar {
  width: 280px;
  height: auto;
  flex-shrink: 0;
  padding: 1rem;
  box-sizing: border-box;
  overflow-y: auto;

  border-left: 1px solid var(--color-border);
  background-color: var(--color-sidebar);
}
</style>
