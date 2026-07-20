<script setup>
import { useAuthStore } from '@/stores/Auth'
import { useGeometryEditorStore } from '@/stores/GeometryEditor'

const authStore = useAuthStore()
const geometryEditorStore = useGeometryEditorStore()
</script>

<template>
  <aside v-if="authStore.isAdminMode" class="admin-toolbar">
    <h3>Herramientas de Administrador</h3>
    <hr />
    <h5>Editor del Mapa</h5>

    <div class="tool-list">
      <button
        type="button"
        :class="{ active: geometryEditorStore.isSelecting }"
        @click="geometryEditorStore.selectTool('select')"
      >
        Seleccionar
      </button>

      <button
        type="button"
        :class="{ active: geometryEditorStore.isDrawing }"
        @click="geometryEditorStore.selectTool('draw')"
      >
        Dibujar
      </button>

      <button
        type="button"
        :class="{ active: geometryEditorStore.isEditing }"
        @click="geometryEditorStore.selectTool('edit')"
      >
        Editar
      </button>

      <button
        type="button"
        :class="{ active: geometryEditorStore.isDeleting }"
        @click="geometryEditorStore.selectTool('delete')"
      >
        Eliminar
      </button>
    </div>
    <button type="button" class="export-button" disabled>Exportar GeoJSON</button>
  </aside>
</template>

<style scoped>
.admin-toolbar {
  width: 200px;
  height: 100%;
  padding: 1rem;
  box-sizing: border-box;
  border-right: 1px solid var(--color-border);
  background-color: var(--color-background);
}

.tool-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tool-list button,
.export-button {
  width: 100%;
  padding: 0.6rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.tool-list button.active {
  background-color: var(--color-niche-zone-outline);
  color: white;
  font-weight: 700;
}

.export-button {
  margin-top: 1rem;
}
</style>
