<script setup>
import { useAuthStore } from '@/stores/Auth'

const authStore = useAuthStore()
</script>

<template>
  <header class="top-bar">
    <h1 class="top-bar-title">Mapa Panteón V2</h1>

    <button type="button" class="admin-mode-button" @click="authStore.toggleAdminMode">
      {{ authStore.isAdminMode ? 'Salir de Admin' : 'Admin' }}
    </button>
  </header>
</template>

<style scoped>
.top-bar {
  border-bottom: 1px solid var(--color-border);
  background-color: var(--color-primary);
}

.top-bar-title {
  color: var(--color-background);
  margin-left: 12px;
}

.admin-mode-button {
  padding: 0.5rem 0.8rem;
  border: none;
  border-radius: 6px;
  font-weight: 700;
  cursor: pointer;
  margin-left: 12px;
  margin-bottom: 5px;
}
</style>
