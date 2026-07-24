<script setup>
import { computed } from 'vue'

import { useNicheStore } from '@/stores/Niche'
import { useGeometryEditorStore } from '@/stores/GeometryEditor'

import DrawPanel from '../panel/DrawPanel.vue'
import GridPanel from '../panel/GridPanel.vue'
import EditPanel from '../panel/EditPanel.vue'
import DeletePanel from '../panel/DeletePanel.vue'
import SelectionPanel from '../panel/SelectionPanel.vue'

const nicheStore = useNicheStore()
const geometryEditorStore = useGeometryEditorStore()

const currentZone = computed(() => {
  return nicheStore.selectedZone?.id ?? 'Mapa principal'
})

const currentSide = computed(() => {
  if (!nicheStore.selectedZone) {
    return 'No aplica'
  }

  return nicheStore.selectedSide === 'concavo' ? 'Cóncavo' : 'Convexo'
})

const currentPanel = computed(() => {
  switch (geometryEditorStore.selectedTool) {
    case 'draw':
      return DrawPanel

    case 'edit':
      return EditPanel

    case 'delete':
      return DeletePanel

    case 'select':
      return SelectionPanel

    case 'grid':
      return GridPanel

    default:
      return SelectionPanel
  }
})
</script>

<template>
  <div class="admin-sidebar">
    <h3>Administrar geometría</h3>

    <section class="admin-context">
      <p>
        <strong>Zona: </strong>
        {{ currentZone }}
      </p>

      <p>
        <strong>Lado: </strong>
        {{ currentSide }}
      </p>
    </section>

    <component :is="currentPanel" />
  </div>
</template>

<style scoped>
.admin-sidebar {
  width: 100%;
  height: 100%;
}

.admin-sidebar h3 {
  margin-top: 0;
}

.admin-context {
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background-color: var(--color-background);
}

.admin-context p {
  margin: 0.5rem 0;
}

.admin-context strong {
  display: block;
}

.admin-placeholder {
  margin-top: 1rem;
}
</style>
