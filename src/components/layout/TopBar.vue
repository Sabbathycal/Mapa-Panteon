<script setup>
import { computed, onMounted, ref } from 'vue'

import { GeometryService } from '@/services/geometry/GeometryService'
import { useSelectionStore } from '@/stores/Selection'
import { useSearchStore } from '@/stores/Search'
import { useNicheStore } from '@/stores/Niche'

import { filterBlockbySection } from '@/utils/geometryFilters'

const selectionStore = useSelectionStore()
const searchStore = useSearchStore()
const nicheStore = useNicheStore()

const sections = ref([])
const blocks = ref([])
const lots = ref([])
const nicheZones = ref([])

const selectedLocationValue = computed(() => {
  if (nicheStore.selectedZone) {
    return `niche:${nicheStore.selectedZone.id}`
  }

  if (selectionStore.selectedSectionId) {
    return `section:${selectionStore.selectedSectionId}`
  }

  return ''
})

onMounted(async () => {
  const [sectionsGeoJSON, blocksGeoJSON, lotsGeoJSON, nicheZonesGeoJSON] = await Promise.all([
    GeometryService.getSections(),
    GeometryService.getBlocks(),
    GeometryService.getLots(),
    GeometryService.getNicheZones(),
  ])

  sections.value = sectionsGeoJSON.features
  blocks.value = blocksGeoJSON.features
  lots.value = lotsGeoJSON.features
  nicheZones.value = nicheZonesGeoJSON.features
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

const availableNicheZones = computed(() => {
  return nicheZones.value
    .map((feature) => feature.properties)
    .filter((zone) => zone?.id)
    .sort((zoneA, zoneB) =>
      String(zoneA.nombre ?? zoneA.id).localeCompare(String(zoneB.nombre ?? zoneB.id), 'es'),
    )
})

const nicheSidesByZone = {
  SPN: ['concavo'],
  PLN: ['concavo', 'convexo'],
}

const sidesBySelectedZone = computed(() => {
  const zoneId = nicheStore.selectedZone?.id

  if (!zoneId) {
    return []
  }

  return nicheSidesByZone[zoneId] ?? ['concavo']
})

const isNicheLocation = computed(() => Boolean(nicheStore.selectedZone))

function handleLocationChange(event) {
  const value = event.target.value

  if (!value) {
    selectionStore.clearSelection()
    nicheStore.clearZone()
    return
  }

  const [type, id] = value.split(':')

  searchStore.clearSearch()

  if (type === 'section') {
    nicheStore.clearZone()
    selectionStore.selectSection(id)
    return
  }

  if (type === 'niche') {
    selectionStore.clearSelection()

    const zone = availableNicheZones.value.find((item) => item.id === id)

    if (zone) {
      nicheStore.selectZone(zone)
    }
  }
}

function handleSecondaryChange(event) {
  const value = event.target.value

  if (isNicheLocation.value) {
    if (!value) {
      nicheStore.selectSide('concavo')
      return
    }

    nicheStore.selectSide(value)
    return
  }

  if (!value) {
    selectionStore.selectSection(selectionStore.selectedSectionId)
    return
  }

  selectionStore.selectBlock(value)
}

function handleSearch() {
  searchStore.searchLots(lots.value)
}

function handleSearchInput() {
  if (!searchStore.query.trim()) {
    searchStore.clearResults()
  }
}

function handleSearchResult(result) {
  searchStore.selectResult(result)
}
</script>

<template>
  <header class="top-bar">
    <h1 class="top-bar-title">Mapa Panteón V2</h1>

    <div class="top-bar-actions">
      <select
        :value="selectedLocationValue"
        aria-label="Seleccionar sección o Zona de nichos"
        @change="handleLocationChange"
      >
        <option value="">Sección o Zona</option>

        <optgroup label="Secciones">
          <option
            v-for="section in sectionsWithBlocks"
            :key="`section-${section.properties.id}`"
            :value="`section:${section.properties.id}`"
          >
            {{ section.properties.id }}
          </option>
        </optgroup>

        <optgroup label="Nichos">
          <option
            v-for="zone in availableNicheZones"
            :key="`niche-${zone.id}`"
            :value="`niche:${zone.id}`"
          >
            {{ zone.nombre ?? zone.id }}
          </option>
        </optgroup>
      </select>

      <select
        :value="isNicheLocation ? nicheStore.selectedSide : (selectionStore.selectedBlockId ?? '')"
        :disabled="!selectionStore.selectedSectionId && !nicheStore.selectedZone"
        :aria-label="isNicheLocation ? 'Seleccionar cara' : 'Seleccionar manzana'"
        @change="handleSecondaryChange"
      >
        <option value="">
          {{ isNicheLocation ? 'Cara' : 'Manzana' }}
        </option>

        <template v-if="isNicheLocation">
          <option v-for="side in sidesBySelectedZone" :key="side" :value="side">
            {{ side === 'concavo' ? 'Cóncavo' : 'Convexo' }}
          </option>
        </template>

        <template v-else>
          <option
            v-for="block in blocksBySelectedSection"
            :key="block.properties.id"
            :value="block.properties.manzana"
          >
            {{ block.properties.nombre }}
          </option>
        </template>
      </select>

      <div class="search-wrapper">
        <div class="search-group">
          <input
            v-model="searchStore.query"
            type="search"
            placeholder="Buscar lote..."
            aria-label="Buscar lote"
            autocomplete="off"
            @input="handleSearchInput"
            @focus="searchStore.openResults"
            @keyup.enter="handleSearch"
            @keyup.esc="searchStore.closeResults"
          />

          <button type="button" :disabled="searchStore.isSearching" @click="handleSearch">
            {{ searchStore.isSearching ? 'Buscando...' : 'Buscar' }}
          </button>
        </div>

        <div v-if="searchStore.isOpen" class="search-results">
          <button
            v-for="result in searchStore.results"
            :key="result.codigo"
            type="button"
            class="search-result"
            @click="handleSearchResult(result)"
          >
            <span class="result-title">
              {{ result.titulo }}
            </span>

            <span class="result-status">
              {{ result.estatus || 'Sin estado' }}
            </span>
          </button>

          <p v-if="searchStore.results.length === 0" class="empty-results">
            No se encontraron lotes.
          </p>
        </div>
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

.search-wrapper {
  position: relative;
}

.search-group {
  display: flex;
  align-items: center;
}

.search-results {
  position: absolute;
  top: calc(100% + 0.4rem);
  right: 0;
  z-index: 1000;

  width: 340px;
  max-height: 320px;
  overflow-y: auto;

  border: 1px solid var(--color-border);
  border-radius: 6px;
  background-color: var(--color-background);
}

.search-result {
  width: 100%;
  padding: 0.7rem 0.8rem;

  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;

  border: none;
  border-bottom: 1px solid var(--color-border);
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.search-result:last-child {
  border-bottom: none;
}

.search-result:hover {
  background-color: var(--color-surface-hover);
}

.result-title {
  font-weight: 600;
}

.result-status {
  font-size: 0.85rem;
  text-transform: capitalize;
}

.empty-results {
  margin: 0;
  padding: 0.9rem;
  text-align: center;
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
