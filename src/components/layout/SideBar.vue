<script setup>
// import { computed, watch } from 'vue'

import InfoSidebar from './InfoSidebar.vue'
// import AdminSidebar from './AdminSidebar.vue'

// import { useAuthStore } from '@/stores/Auth.js'
import { useSidebarStore } from '@/stores/Sidebar.js'

// const authStore = useAuthStore()
const sidebarStore = useSidebarStore()

// const isInfoView = computed(() => {
//   return sidebarStore.activeView === 'info'
// })

// watch(
//   () => authStore.isAdminMode,
//   (isAdminMode) => {
//     if (!isAdminMode) {
//       sidebarStore.resetView()
//     }
//   },
// )
</script>

<template>
  <aside class="sidebar">
    <!-- <div v-if="authStore.isAdminMode" class="sidebar-tabs">
      <button type="button" :class="{ active: isInfoView }" @click="sidebarStore.showInfo">
        Información
      </button>

      <button type="button" :class="{ active: !isInfoView }" @click="sidebarStore.showAdmin">
        Administrar
      </button>
    </div> -->
    <div class="sidebar-header">
      <button
        type="button"
        class="close-button"
        aria-label="Cerrar panel lateral"
        title="Cerrar Panel"
        @click="sidebarStore.closeSidebar"
      >
        ×
      </button>
    </div>

    <InfoSidebar />
    <!-- <AdminSidebar v-else /> -->
  </aside>
</template>

<style scoped>
.sidebar {
  width: 280px;
  height: 100%;
  flex-shrink: 0;
  padding: 1rem;
  box-sizing: border-box;

  overflow-y: auto;
  overscroll-behavior: contain;

  border-left: 1px solid var(--color-border);
  background-color: var(--color-sidebar);
}

.sidebar-header {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  height: 2.25rem;
  margin-bottom: -2.25rem;
  position: relative;
  z-index: 1;
  pointer-events: none;
}

.close-button {
  width: 2.25rem;
  height: 2.25rem;
  pointer-events: auto;
}

.close-button:hover {
  background-color: var(--color-background);
}

/* .sidebar-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.sidebar-tabs button {
  flex: 1;
  padding: 0.55rem 0.4rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-weight: 700;
  cursor: pointer;
}

.sidebar-tabs button.active {
  background-color: var(--color-niche-zone-outline);
  color: black;
} */
</style>
