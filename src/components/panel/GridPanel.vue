<script setup>
import { computed } from 'vue'

import { useGridEditorStore } from '@/stores/GridEditorStore'
import { useGeometryEditorStore } from '@/stores/GeometryEditor'
import { useGeometryDraftStore } from '@/stores/GeometryDraft'

const gridEditorStore = useGridEditorStore()
const geometryEditorStore = useGeometryEditorStore()
const geometryDraftStore = useGeometryDraftStore()

const panelTitle = computed(() => {
  return geometryEditorStore.geometryType === 'lots' ? 'Generador de Lotes' : 'Generador de nichos'
})
</script>

<template>
  <section class="grid-panel">
    <h4>Cuadricula - {{ panelTitle }}</h4>

    <p>
      Geometrias en Borrador:
      <strong>{{ geometryDraftStore.featureCount }}</strong>
    </p>

    <div class="grid-form">
      <label>
        Filas
        <input v-model.number="gridEditorStore.rows" type="number" min="1" />
      </label>

      <label>
        Columnas
        <input v-model.number="gridEditorStore.columns" type="number" min="1" />
      </label>

      <label>
        Ancho
        <input v-model.number="gridEditorStore.cellWidth" type="number" min="1" />
      </label>

      <label>
        Altura
        <input v-model.number="gridEditorStore.cellHeight" type="number" min="1" />
      </label>

      <label>
        Espacio(X)
        <input v-model.number="gridEditorStore.spacingX" type="number" min="1" />
      </label>

      <label>
        Espacio(Y)
        <input v-model.number="gridEditorStore.spacingY" type="number" min="1" />
      </label>

      <label>
        Rotación
        <input v-model.number="gridEditorStore.rotation" type="number" min="1" />
      </label>

      <label>
        Número Inicial
        <input v-model.number="gridEditorStore.startNumber" type="number" min="1" />
      </label>
    </div>

    <div class="grid-actions">
      <button type="button" @click="gridEditorStore.requestGridGeneration">Generar</button>

      <button type="button" @click="gridEditorStore.resetGrid">Restablecer</button>

      <button
        type="button"
        :disabled="geometryDraftStore.featureCount === 0"
        @click="geometryDraftStore.clearDraft"
      >
        Limpiar borrador
      </button>
    </div>
  </section>
</template>

<style scoped>
.grid-panel {
  padding-top: 1rem;
}

.grid-panel h4 {
  margin-top: 0;
}

.grid-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.grid-form label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-weight: 600;
}

.grid-form input {
  width: 100%;
  padding: 0.55rem;
  box-sizing: border-box;

  border: 1px solid var(--color-border);
  border-radius: 4px;
  background-color: var(--color-background);
  color: var(--color-text);
}

.grid-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.grid-actions button {
  flex: 1;
  padding: 0.6rem;
  cursor: pointer;
}
</style>
