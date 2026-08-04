<script setup>
import { computed, onMounted, ref, watch } from 'vue'

import { useSelectionStore } from '@/stores/Selection'
import { useNicheStore } from '@/stores/Niche'
import { useSearchStore } from '@/stores/Search'

import { LotService } from '@/services/lot/LotService'
import { GeometryService } from '@/services/geometry/GeometryService'
import { filterLotsbyBlocks } from '@/utils/geometryFilters'

import PropertyDetailsModal from './PropertyDetailsModal.vue'

const lots = ref(null)
const niches = ref(null)
const activeLotFilter = ref('todos')
const activeNicheFilter = ref('todos')
const isPropertyModalOpen = ref(false)

const selectionStore = useSelectionStore()
const nicheStore = useNicheStore()
const searchStore = useSearchStore()
const selectedNiche = computed(() => nicheStore.selectedNiche)

const selectedLot = computed(() => {
  if (!selectionStore.selectedLotId) {
    return null
  }

  return LotService.getLotbyId(
    selectionStore.selectedLotId,
    selectionStore.selectedSectionId,
    selectionStore.selectedBlockId,
    selectionStore.selectedLotStatus,
  )
})

const selectedProperty = computed(() => {
  return selectedNiche.value || selectedLot.value
})

const hasSearchQuery = computed(() => {
  return searchStore.query.trim().length > 0
})

const searchResultCount = computed(() => {
  return searchStore.results.length
})

const canGoBack = computed(() => {
  return selectionStore.canGoBack || nicheStore.canGoBack
})

const selectedBlockLots = computed(() => {
  if (!lots.value || !selectionStore.selectedSectionId || !selectionStore.selectedBlockId) {
    return []
  }

  const filteredLots = filterLotsbyBlocks(
    lots.value,
    selectionStore.selectedSectionId,
    selectionStore.selectedBlockId,
  )

  return filteredLots?.features ?? []
})

const blockSummary = computed(() => {
  const summary = {
    total: selectedBlockLots.value.length,
    disponibles: 0,
    separados: 0,
    vendidos: 0,
    ocupados: 0,
    sinEstado: 0,
  }

  selectedBlockLots.value.forEach((feature) => {
    const properties = feature?.properties ?? {}

    const saleStatus = normalizeStatus(properties.estatus_venta || properties.estatus)

    const occupationStatus = normalizeStatus(properties.estatus_ocupacion)

    if (occupationStatus === 'ocupado' || saleStatus === 'ocupado') {
      summary.ocupados++
      return
    }

    if (saleStatus === 'separado') {
      summary.separados++
      return
    }

    if (saleStatus === 'vendido') {
      summary.vendidos++
      return
    }

    if (saleStatus === 'disponible') {
      summary.disponibles++
      return
    }

    summary.sinEstado++
  })

  return summary
})

const selectedZoneNiches = computed(() => {
  if (!niches.value || !nicheStore.selectedZone?.id) {
    return []
  }

  return (niches.value.features ?? []).filter((feature) => {
    return feature?.properties?.zonaId === nicheStore.selectedZone.id
  })
})

const lotFilterOptions = computed(() => [
  {
    id: 'todos',
    label: 'Todos',
    count: blockSummary.value.total,
  },
  {
    id: 'disponible',
    label: 'Disponible',
    count: blockSummary.value.disponibles,
  },
  {
    id: 'separado',
    label: 'Separado',
    count: blockSummary.value.separados,
  },
  {
    id: 'vendido',
    label: 'Vendido',
    count: blockSummary.value.vendidos,
  },
  {
    id: 'ocupado',
    label: 'Ocupado',
    count: blockSummary.value.ocupados,
  },
  {
    id: 'sin-estado',
    label: 'Sin estado',
    count: blockSummary.value.sinEstado,
  },
])

const nicheFilterOptions = computed(() => {
  const summary = activeNicheSideSummary.value?.summary

  if (!summary) {
    return []
  }

  return [
    {
      id: 'todos',
      label: 'Todos',
      count: summary.total,
    },
    {
      id: 'disponible',
      label: 'Disponible',
      count: summary.disponibles,
    },
    {
      id: 'separado',
      label: 'Separado',
      count: summary.separados,
    },
    {
      id: 'vendido',
      label: 'Vendido',
      count: summary.vendidos,
    },
    {
      id: 'ocupado',
      label: 'Ocupado',
      count: summary.ocupados,
    },
    {
      id: 'sin-estado',
      label: 'Sin estado',
      count: summary.sinEstado,
    },
  ]
})

function selectNicheFilter(filterId) {
  activeNicheFilter.value = filterId
}

const nicheSideSummaries = computed(() => {
  const sides = ['concavo', 'convexo']

  return sides
    .map((side) => {
      const sideFeatures = selectedZoneNiches.value.filter((feature) => {
        return normalizeStatus(feature?.properties?.cara) === side
      })

      return {
        id: side,
        label: side === 'concavo' ? 'Cóncavo' : 'Convexo',
        summary: createNicheSummary(sideFeatures),
      }
    })
    .filter((side) => side.summary.total > 0)
})

const activeNicheSideSummary = computed(() => {
  return nicheSideSummaries.value.find((side) => side.id === nicheStore.selectedSide) ?? null
})

function selectLotFilter(filterId) {
  activeLotFilter.value = filterId
}

function handleGoBack() {
  searchStore.clearSearch()

  if (nicheStore.canGoBack) {
    nicheStore.goBack()
    return
  }

  selectionStore.goBack()
}

function normalizeStatus(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function openPropertyModal() {
  isPropertyModalOpen.value = true
}

function closePropertyModal() {
  isPropertyModalOpen.value = false
}

function createNicheSummary(features) {
  const summary = {
    total: features.length,
    disponibles: 0,
    separados: 0,
    vendidos: 0,
    ocupados: 0,
    sinEstado: 0,
  }

  features.forEach((feature) => {
    const properties = feature?.properties ?? {}

    const saleStatus = normalizeStatus(properties.estatus_venta)
    const occupationStatus = normalizeStatus(properties.estatus_ocupacion)

    if (occupationStatus === 'ocupado' || saleStatus === 'ocupado') {
      summary.ocupados++
      return
    }

    if (saleStatus === 'separado') {
      summary.separados++
      return
    }

    if (saleStatus === 'vendido') {
      summary.vendidos++
      return
    }

    if (saleStatus === 'disponible') {
      summary.disponibles++
      return
    }

    summary.sinEstado++
  })

  return summary
}

onMounted(async () => {
  const [loadedLots, loadedNiches] = await Promise.all([
    GeometryService.getLots(),
    GeometryService.getAllNiches(),
  ])

  lots.value = loadedLots
  niches.value = loadedNiches
})

watch(
  () => nicheStore.selectedSide,
  () => {
    activeNicheFilter.value = 'todos'
  },
)
</script>

<template>
  <div class="info-sidebar">
    <button v-if="canGoBack" type="button" class="back-button" @click="handleGoBack">
      ← Volver
    </button>

    <section v-if="selectedNiche" class="property-summary">
      <h2>Nicho</h2>

      <div class="property-summary-card">
        <dl class="property-summary-data">
          <div>
            <dt>ZONA:</dt>
            <dd>{{ selectedNiche.zonaId }}</dd>
          </div>

          <div>
            <dt>CARA:</dt>
            <dd>{{ selectedNiche.cara }}</dd>
          </div>

          <div>
            <dt>NICHO:</dt>
            <dd>{{ selectedNiche.codigo }}</dd>
          </div>

          <div>
            <dt>Estado:</dt>
            <dd>
              {{ selectedNiche.estatus_ocupacion || selectedNiche.estatus_venta || '-' }}
            </dd>
          </div>

          <div>
            <dt>Referencia ProCaP:</dt>
            <dd>{{ selectedNiche.referencia_procap || '-' }}</dd>
          </div>

          <div class="secondary-property-data">
            <dt>ID:</dt>
            <dd>{{ selectedNiche.id || '-' }}</dd>
          </div>
        </dl>
      </div>

      <button type="button" class="more-info-button" @click="openPropertyModal">
        Más información
      </button>
    </section>

    <section v-else-if="selectedLot" class="property-summary">
      <h2>Lote</h2>

      <div class="property-summary-card">
        <dl class="property-summary-data">
          <div>
            <dt>SECCIÓN:</dt>
            <dd>{{ selectedLot.seccionId }}</dd>
          </div>

          <div>
            <dt>MANZANA:</dt>
            <dd>{{ selectedLot.manzanaId }}</dd>
          </div>

          <div>
            <dt>LOTE:</dt>
            <dd>{{ selectedLot.lote }}</dd>
          </div>

          <div>
            <dt>Estado:</dt>
            <dd>
              {{ selectedLot.estatus_ocupacion || selectedLot.estatus_venta || '-' }}
            </dd>
          </div>

          <div>
            <dt>Referencia ProCaP:</dt>
            <dd>{{ selectedLot.referencia_procap || '-' }}</dd>
          </div>

          <div class="secondary-property-data">
            <dt>ID:</dt>
            <dd>{{ selectedLot.codigo }}</dd>
          </div>
        </dl>
      </div>

      <button type="button" class="more-info-button" @click="openPropertyModal">
        Más información
      </button>
    </section>

    <section
      v-else-if="selectionStore.selectedBlockId && !nicheStore.selectedZone"
      class="block-panel"
    >
      <header class="block-panel-header">
        <h2>
          SECCIÓN {{ selectionStore.selectedSectionId }} — MANZANA
          {{ selectionStore.selectedBlockId }}
        </h2>

        <p>
          Sección:
          <strong>{{ selectionStore.selectedSectionId }}</strong>
        </p>

        <p>
          Selecciona un lote o usa
          <strong>Mostrar lotes</strong>.
        </p>
      </header>

      <div class="block-panel-section">
        <h3>Visualización de lotes</h3>

        <button
          type="button"
          class="lots-visibility-button"
          @click="selectionStore.toggleLotsVisibility"
        >
          {{ selectionStore.areLotsVisible ? 'Ocultar lotes' : 'Mostrar lotes' }}
        </button>
      </div>

      <div class="block-panel-section">
        <h3>Filtrar lotes por estatus</h3>

        <div class="lot-filter-grid">
          <button
            v-for="filter in lotFilterOptions"
            :key="filter.id"
            type="button"
            class="lot-filter-button"
            :class="{ active: activeLotFilter === filter.id }"
            @click="selectLotFilter(filter.id)"
          >
            {{ filter.label }} ({{ filter.count }})
          </button>
        </div>

        <p class="active-filter">
          Filtro actual:
          <strong>{{ activeLotFilter }}</strong>
        </p>
      </div>

      <section class="block-summary-card">
        <h3>Resumen de manzana</h3>

        <dl>
          <div>
            <dt>Total:</dt>
            <dd>{{ blockSummary.total }}</dd>
          </div>

          <div>
            <dt>Disponible:</dt>
            <dd>{{ blockSummary.disponibles }}</dd>
          </div>

          <div>
            <dt>Separado:</dt>
            <dd>{{ blockSummary.separados }}</dd>
          </div>

          <div>
            <dt>Vendido:</dt>
            <dd>{{ blockSummary.vendidos }}</dd>
          </div>

          <div>
            <dt>Ocupado:</dt>
            <dd>{{ blockSummary.ocupados }}</dd>
          </div>

          <div>
            <dt>Sin estado:</dt>
            <dd>{{ blockSummary.sinEstado }}</dd>
          </div>
        </dl>
      </section>
    </section>

    <section v-else-if="nicheStore.selectedZone" class="niche-zone-panel">
      <header class="niche-zone-header">
        <h2>
          ZONA DE NICHOS
          {{ nicheStore.selectedZone.id }}
        </h2>

        <p>Selecciona una cara para consultar el resumen de sus nichos.</p>
      </header>

      <div class="niche-zone-section">
        <h3>Caras disponibles</h3>

        <div class="niche-side-grid">
          <button
            v-for="side in nicheSideSummaries"
            :key="side.id"
            type="button"
            class="niche-side-button"
            :class="{ active: nicheStore.selectedSide === side.id }"
            @click="nicheStore.selectSide(side.id)"
          >
            {{ side.label }} ({{ side.summary.total }})
          </button>
        </div>
      </div>
      <div class="niche-zone-section">
        <h3>Filtrar nichos por estatus</h3>

        <div class="niche-filter-grid">
          <button
            v-for="filter in nicheFilterOptions"
            :key="filter.id"
            type="button"
            class="niche-filter-button"
            :class="{ active: activeNicheFilter === filter.id }"
            @click="selectNicheFilter(filter.id)"
          >
            {{ filter.label }} ({{ filter.count }})
          </button>
        </div>

        <p class="active-filter">
          Filtro actual:
          <strong>{{ activeNicheFilter }}</strong>
        </p>
      </div>
      <section v-if="activeNicheSideSummary" class="niche-summary-card">
        <h3>
          Resumen —
          {{ activeNicheSideSummary.label }}
        </h3>

        <dl>
          <div>
            <dt>Total:</dt>
            <dd>{{ activeNicheSideSummary.summary.total }}</dd>
          </div>

          <div>
            <dt>Disponible:</dt>
            <dd>{{ activeNicheSideSummary.summary.disponibles }}</dd>
          </div>

          <div>
            <dt>Separado:</dt>
            <dd>{{ activeNicheSideSummary.summary.separados }}</dd>
          </div>

          <div>
            <dt>Vendido:</dt>
            <dd>{{ activeNicheSideSummary.summary.vendidos }}</dd>
          </div>

          <div>
            <dt>Ocupado:</dt>
            <dd>{{ activeNicheSideSummary.summary.ocupados }}</dd>
          </div>

          <div v-if="activeNicheSideSummary.summary.sinEstado > 0">
            <dt>Sin estado:</dt>
            <dd>{{ activeNicheSideSummary.summary.sinEstado }}</dd>
          </div>
        </dl>
      </section>
    </section>

    <div v-else-if="hasSearchQuery" class="search-prompt">
      <h2>Búsqueda de propiedades</h2>

      <p v-if="searchResultCount > 0">
        Se encontraron
        <strong>{{ searchResultCount }}</strong>
        propiedades.
      </p>

      <p v-else>No se encontraron propiedades con esa búsqueda.</p>

      <p v-if="searchResultCount > 0" class="search-prompt-hint">
        Selecciona un lote o nicho desde los resultados del buscador para consultar su ubicación e
        información.
      </p>
    </div>

    <p v-else>Haz clic en cualquier elemento del mapa.</p>

    <PropertyDetailsModal
      v-if="isPropertyModalOpen && selectedProperty"
      :property="selectedProperty"
      @close="closePropertyModal"
    />
  </div>
</template>

<style scoped>
.info-sidebar {
  width: 100%;
  min-height: 100%;
}

.back-button {
  min-height: 2.25rem;
  margin-bottom: 1rem;
}

.property-summary {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.property-summary h2 {
  margin: 0;
  font-size: 1.1rem;
}

.property-summary-data {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  margin: 0;

  font-size: 0.85rem;
}

.property-summary-card {
  width: 100%;
  padding: 0.75rem;
  box-sizing: border-box;

  border: 1px solid var(--color-border);
  border-radius: 10px;

  background-color: var(--color-background);
  box-shadow: 0 2px 6px rgb(0 0 0 / 6%);
}

.property-summary-data div {
  display: flex;
  gap: 0.3rem;
}

.property-summary-data dt {
  font-weight: 700;
}

.property-summary-data dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.secondary-property-data {
  color: var(--color-text-muted, var(--color-text));
  font-size: 0.76rem;
}

.more-info-button {
  padding: 0.5rem 0.8rem;
  width: 100%;

  border: 1px solid var(--color-border);
  border-radius: 10px;

  background-color: var(--color-background);
  color: var(--color-text);

  font: inherit;
  font-size: 1.1rem;
  font-weight: 700;
  cursor: pointer;

  box-shadow: 0 2px 6px rgb(0 0 0 / 7%);
}

.more-info-button:hover {
  filter: brightness(0.87);
}

.search-prompt {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-top: 0.5rem;
}

.search-prompt h2 {
  margin: 0;
  font-size: 1.15rem;
}

.search-prompt p {
  margin: 0;
  line-height: 1.5;
}

.search-prompt-hint {
  color: var(--color-text-muted, var(--color-text));
}

.block-panel {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.block-panel-header {
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--color-border);
}

.block-panel-header h2 {
  margin: 0 0 0.65rem;
  font-size: 1rem;
  line-height: 1.25;
}

.block-panel-header p {
  margin: 0.35rem 0 0;
  line-height: 1.35;
  font-size: 0.85rem;
}

.block-panel-section {
  padding: 0.8rem 0;
  border-bottom: 1px solid var(--color-border);
}

.block-panel-section h3 {
  margin: 0 0 0.55rem;
  font-size: 0.9rem;
}

.lots-visibility-button {
  width: 100%;
  padding: 0.5rem 0.75rem;

  border: 1px solid var(--color-border);
  border-radius: 10px;

  background-color: var(--color-background);
  color: var(--color-text);

  font: inherit;
  font-size: 1.1rem;
  font-weight: 700;
  cursor: pointer;

  box-shadow: 0 2px 6px rgb(0 0 0 / 7%);
}

.lots-visibility-button:hover {
  filter: brightness(0.87);
}

.lot-filter-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.lot-filter-button {
  padding: 0.4rem 0.55rem;

  border: 1px solid var(--color-border);
  border-radius: 10px;

  background-color: var(--color-background);
  color: var(--color-text);

  font: inherit;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;

  box-shadow: 0 2px 6px rgb(0 0 0 / 7%);
}

.lot-filter-button:hover {
  filter: brightness(0.87);
}

.lot-filter-button.active {
  outline: 2px solid var(--color-block-outline);
  outline-offset: 1px;
}

.active-filter {
  margin: 0.55rem 0 0;
  font-size: 0.78rem;
  color: var(--color-text-muted, var(--color-text));
}

.block-summary-card {
  margin-top: 0.75rem;
  padding: 0.65rem;

  border: 1px solid var(--color-border);
  border-radius: 10px;

  background-color: var(--color-background);
}

.block-summary-card h3 {
  margin: 0 0 0.4rem;
  font-size: 0.85rem;
}

.block-summary-card dl {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin: 0;
  font-size: 0.8rem;
}

.block-summary-card dl div {
  display: flex;
  gap: 0.3rem;
}

.block-summary-card dt,
.block-summary-card dd {
  margin: 0;
}

.block-summary-card dd {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.niche-zone-panel {
  display: flex;
  flex-direction: column;
}

.niche-zone-header {
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--color-border);
}

.niche-zone-header h2 {
  margin: 0 0 0.65rem;
  font-size: 1rem;
  line-height: 1.25;
}

.niche-zone-header p {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.35;
}

.niche-zone-section {
  padding: 0.8rem 0;
  border-bottom: 1px solid var(--color-border);
}

.niche-zone-section h3 {
  margin: 0 0 0.55rem;
  font-size: 0.9rem;
}

.niche-side-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.niche-side-button {
  padding: 0.4rem 0.6rem;

  border: 1px solid var(--color-border);
  border-radius: 10px;

  background-color: var(--color-background);
  color: var(--color-text);

  font: inherit;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;

  box-shadow: 0 2px 6px rgb(0 0 0 / 7%);
}

.niche-side-button:hover {
  filter: brightness(0.87);
}

.niche-side-button.active {
  outline: 2px solid var(--color-block-outline);
  outline-offset: 1px;
}

.niche-summary-card {
  margin-top: 0.75rem;
  padding: 0.65rem;

  border: 1px solid var(--color-border);
  border-radius: 10px;

  background-color: var(--color-background);
}

.niche-summary-card h3 {
  margin: 0 0 0.4rem;
  font-size: 0.85rem;
}

.niche-summary-card dl {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;

  margin: 0;
  font-size: 0.8rem;
}

.niche-summary-card dl div {
  display: flex;
  gap: 0.3rem;
}

.niche-summary-card dt,
.niche-summary-card dd {
  margin: 0;
}

.niche-summary-card dd {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.niche-filter-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.niche-filter-button {
  padding: 0.4rem 0.55rem;

  border: 1px solid var(--color-border);
  border-radius: 10px;

  background-color: var(--color-background);
  color: var(--color-text);

  font: inherit;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;

  box-shadow: 0 2px 6px rgb(0 0 0 / 7%);
}

.niche-filter-button:hover {
  filter: brightness(0.87);
}

.niche-filter-button.active {
  outline: 2px solid var(--color-block-outline);
  outline-offset: 1px;
}
</style>
