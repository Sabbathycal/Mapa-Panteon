<script setup>
import { computed, watch } from 'vue'

import TopBar from './TopBar.vue'
import Sidebar from './SideBar.vue'
import AdminToolbar from '../admin/AdminToolbar.vue'

import { useSelectionStore } from '@/stores/Selection'
import { useNicheStore } from '@/stores/Niche'
import { useSearchStore } from '@/stores/Search'
import { useSidebarStore } from '@/stores/Sidebar.js'

const selectionStore = useSelectionStore()
const nicheStore = useNicheStore()
const searchStore = useSearchStore()
const sidebarStore = useSidebarStore()

const sidebarContext = computed(() => {
  return [
    selectionStore.selectedSectionId,
    selectionStore.selectedBlockId,
    selectionStore.selectedLotId,
    nicheStore.selectedZone?.id ?? null,
    nicheStore.selectedSide,
    nicheStore.selectedNiche?.id ?? nicheStore.selectedNiche?.codigo ?? null,
    searchStore.query.trim(),
  ]
})

const hasSidebarContext = computed(() => {
  return Boolean(
    selectionStore.selectedSectionId || nicheStore.selectedZone || searchStore.query.trim(),
  )
})

watch(sidebarContext, (currentContext, previousContext) => {
  const contextChanged = currentContext.some((value, index) => value !== previousContext?.[index])

  const hasContext = Boolean(
    selectionStore.selectedSectionId || nicheStore.selectedZone || searchStore.query.trim(),
  )

  if (contextChanged && hasContext) {
    sidebarStore.openSidebar()
  }

  if (!hasContext) {
    sidebarStore.closeSidebar()
  }
})
</script>

<template>
  <div class="app-layout">
    <TopBar />

    <div class="app-content">
      <AdminToolbar />

      <main class="main-content">
        <RouterView />
      </main>

      <button
        v-if="hasSidebarContext && !sidebarStore.isOpen"
        type="button"
        class="open-sidebar-button"
        aria-label="Mostrar panel lateral"
        title="Mostrar panel"
        @click="sidebarStore.openSidebar"
      >
        ‹
      </button>

      <Sidebar v-if="sidebarStore.isOpen" />
    </div>
  </div>
</template>

<style scoped>
.app-layout {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.app-content {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
  position: relative;
}

.main-content {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.open-sidebar-button {
  position: absolute;
  top: 50%;
  right: 0;
  z-index: 1000;

  width: 2.25rem;
  height: 3.5rem;
  padding: 0;

  border: 1px solid var(--color-border-2);
  border-right: 0;
  border-radius: 8px 0 0 8px;

  background-color: var(--color-sidebar);
  color: var(--color-text);

  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1;

  cursor: pointer;
  transform: translateY(-50%);
}

.open-sidebar-button:hover {
  background-color: var(--color-background);
}
</style>
