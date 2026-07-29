<script setup>
import { computed } from 'vue'

import { useAuthStore } from '@/stores/Auth'
import { useGeometryEditorStore } from '@/stores/GeometryEditor'
import { useNicheStore } from '@/stores/Niche'
import { useGeometryDraftStore } from '@/stores/GeometryDraft'
import { useSelectionStore } from '@/stores/Selection'

import { exportGeoJSON } from '@/utils/exportGeoJSON'

const authStore = useAuthStore()
const geometryEditorStore = useGeometryEditorStore()
const nicheStore = useNicheStore()
const geometryDraftStore = useGeometryDraftStore()
const selectionStore = useSelectionStore()

const currentGeometry = computed(() => {
  return nicheStore.selectedZone ? `Nichos` : 'Mapa principal'
})

const exportFileName = computed(() => {
  if (geometryEditorStore.geometryType === 'niches') {
    const zoneId = nicheStore.selectedZone?.id ?? 'nichos'
    const side = nicheStore.selectedSide ?? 'sin-lado'

    return `${zoneId}-${side}`
  }

  const sectionId = selectionStore.selectedSectionId ?? 'lotes'
  const blockId = selectionStore.selectedBlockId ?? null

  return blockId ? `${sectionId}-${blockId}-lotes` : `${sectionId}-lotes`
})

function handleExport() {
  exportGeoJSON(geometryDraftStore.featureCollection, exportFileName.value)
}
</script>

<template>
  <aside v-if="authStore.isAdminMode" class="admin-toolbar">
    <h3>Herramientas de Administrador</h3>
    <section class="toolbar-section">
      <h4>Editor del Mapa</h4>
      <hr />
      <p>
        <strong> Geometría: </strong>
        {{ currentGeometry }}
      </p>
      <hr />
      <div class="tool-list">
        <button
          type="button"
          :class="{ active: geometryEditorStore.isDrawing }"
          @click="geometryEditorStore.selectTool('draw')"
        >
          Dibujar
        </button>

        <button
          type="button"
          :class="{ active: geometryEditorStore.isGrid }"
          @click="geometryEditorStore.selectTool('grid')"
        >
          Cuadrícula
        </button>

        <button
          type="button"
          :class="{ active: geometryEditorStore.isEditing }"
          @click="geometryEditorStore.selectTool('edit')"
        >
          Editar
        </button>
      </div>
    </section>

    <button
      type="button"
      class="export-button"
      :disabled="geometryDraftStore.featureCount === 0"
      @click="handleExport"
    >
      Exportar GeoJSON
    </button>
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

.toolbar-section {
  padding-top: 1rem;
  margin-top: 1rem;
  border-top: 1px solid var(--color-border);
}

.toolbar-section h4 {
  margin: 0 0 0.75rem;
}

.editor-status p {
  margin: 0.5rem 0;
}

.editor-status strong {
  display: block;
}
</style>
