<script setup>
import { computed, onMounted, ref } from 'vue'

import { GeometryService } from '@/services/geometry/GeometryService'
import { useSelectionStore } from '@/stores/Selection'

import { filterBlockbySection } from '@/utils/geometryFilters'

const selectionStore = useSelectionStore()

const sections = ref([])
const blocks = ref([])

onMounted(async () => {
  const [sectionsGeoJSON, blocksGeoJSON] = await Promise.all([
    GeometryService.getSections(),
    GeometryService.getBlocks(),
  ])

  sections.value = sectionsGeoJSON.features
  blocks.value = blocksGeoJSON.features
})

//Filtra secciones con bloques y bloques por secciones, es decir,
//solo muestra la informacion relevante y valida.
const sectionsWithBlocks = computed(() => {
  const blocksFeatureCollection = {
    type: 'FeatureCollection',
    features: blocks.value,
  }

  return sections.value.filter((section) => {
    const sectionId = section.properties.id

    const filteredBlocks = filterBlockbySection(blocksFeatureCollection, sectionId)

    return filteredBlocks.features.length > 0
  })
})

const blocksBySelectedSection = computed(() => {
  if (!selectionStore.selectedSectionId) {
    return []
  }

  const blocksFeatureCollection = {
    type: 'FeatureCollection',
    features: blocks.value,
  }

  return filterBlockbySection(
    blocksFeatureCollection,
    selectionStore.selectedSectionId,
  ).features.sort((blockA, blockB) => {
    const idA = String(blockA.properties.manzana).trim().toUpperCase()
    const idB = String(blockB.properties.manzana).trim().toUpperCase()

    if (idA.length !== idB.length) {
      return idA.length - idB.length
    }

    return idA.localeCompare(idB, 'es')
  })
})

function handleSectionChange(event) {
  const sectionId = event.target.value

  if (!sectionId) {
    selectionStore.clearSelection()
    return
  }

  selectionStore.selectSection(sectionId)
}

function handleBlockChange(event) {
  const blockId = event.target.value

  if (!blockId) {
    selectionStore.selectSection(selectionStore.selectedSectionId)
    return
  }

  selectionStore.selectBlock(blockId)
}
</script>

<template>
  <header class="top-bar">
    <h1 class="top-bar-title">Mapa Panteón V2</h1>

    <div class="top-bar-actions">
      <select
        :value="selectionStore.selectedSectionId ?? ''"
        aria-label="Seleccionar sección"
        @change="handleSectionChange"
      >
        <option value="">Sección</option>
        <option
          v-for="section in sectionsWithBlocks"
          :key="section.properties.id"
          :value="section.properties.id"
        >
          {{ section.properties.id }}
        </option>
      </select>

      <select
        :value="selectionStore.selectedBlockId ?? ''"
        :disabled="!selectionStore.selectedSectionId"
        aria-label="Seleccionar Manzana"
        @change="handleBlockChange"
      >
        <option value="">Manzana</option>
        <option
          v-for="block in blocksBySelectedSection"
          :key="block.properties.id"
          :value="block.properties.manzana"
        >
          {{ block.properties.nombre }}
        </option>
      </select>

      <div class="search-group">
        <input type="search" placeholder="Busca lote o nicho..." aria-label="Buscar lote o nicho" />

        <button type="button">Buscar</button>
      </div>

      <button type="button" class="user-button">Usuario</button>
    </div>
  </header>
</template>

<style scoped>
.top-bar {
  width: 100%;
  min-height: 64px;
  padding: 0.75rem 1rem;
  box-sizing: border-box;

  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;

  border-bottom: 1px solid var(--color-border);
  background-color: var(--color-primary);
}

.top-bar-title {
  margin: 0;
  flex-shrink: 0;
  font-size: 40px;
  color: white;
}

.top-bar-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.65rem;
  min-width: 0;
}

.top-bar-actions select,
.search-group input,
.top-bar-actions button {
  height: 38px;
  padding: 0 0.75rem;
  box-sizing: border-box;

  border: 1px solid var(--color-border);
  border-radius: 6px;
  background-color: var(--color-background);
  font: inherit;
}

.top-bar-actions select {
  min-width: 135px;
}

.search-group {
  display: flex;
  align-items: center;
}

.search-group input {
  width: min(320px, 26vw);
  border-radius: 6px 0 0 6px;
}

.search-group button {
  border-left: none;
  border-radius: 0 6px 6px 0;
  cursor: pointer;
}

.user-button {
  min-width: 90px;
  cursor: pointer;
}

@media (max-width: 900px) {
  .top-bar {
    align-items: flex-start;
  }

  .top-bar-actions {
    flex-wrap: wrap;
  }

  .search-group input {
    width: 220px;
  }
}
</style>
