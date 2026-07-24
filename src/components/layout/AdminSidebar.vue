<script setup>
import { computed } from 'vue'

import { useNicheStore } from '@/stores/Niche'
import { useGeometryEditorStore } from '@/stores/GeometryEditor'

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

const currentTool = computed(() => {
  const toolNames = {
    select: 'Seleccionar',
    draw: 'Dibujar',
    edit: 'Editar',
    delete: 'Eliminar',
  }

  return toolNames[geometryEditorStore.selectedTool] ?? 'Sin herramienta'
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

      <p>
        <strong>Herramienta: </strong>
        {{ currentTool }}
      </p>
    </section>

    <p class="admin-placeholder">La configuracion de la herramienta activa aparecerá aquí.</p>
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
