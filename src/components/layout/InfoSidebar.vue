<script setup>
import { computed } from 'vue'

import { useSelectionStore } from '@/stores/Selection'
import { useNicheStore } from '@/stores/Niche'
import { useSearchStore } from '@/stores/Search'

import { LotService } from '@/services/lot/LotService'

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

const hasSearchQuery = computed(() => {
  return searchStore.query.trim().length > 0
})

const searchResultCount = computed(() => {
  return searchStore.results.length
})

const canGoBack = computed(() => {
  return selectionStore.canGoBack || nicheStore.canGoBack
})

function handleGoBack() {
  searchStore.clearSearch()

  if (nicheStore.canGoBack) {
    nicheStore.goBack()
    return
  }

  selectionStore.goBack()
}
</script>

<template>
  <div class="info-sidebar">
    <button v-if="canGoBack" type="button" class="back-button" @click="handleGoBack">
      ← Volver
    </button>

    <div v-if="selectedNiche" class="selection-details">
      <label>
        Zona:
        <input :value="selectedNiche.zonaId" readonly />
      </label>

      <label>
        Cara:
        <input :value="selectedNiche.cara" readonly />
      </label>

      <label>
        Fila:
        <input :value="selectedNiche.fila" readonly />
      </label>

      <label>
        Número:
        <input :value="selectedNiche.numero" readonly />
      </label>

      <label>
        Código:
        <input :value="selectedNiche.codigo" readonly />
      </label>

      <label>
        Estado de venta:
        <input :value="selectedNiche.estatus_venta || '-'" readonly />
      </label>

      <label>
        Estado de ocupación:
        <input :value="selectedNiche.estatus_ocupacion || '-'" readonly />
      </label>

      <label>
        Referencia ProCaP:
        <input :value="selectedNiche.referencia_procap || '-'" readonly />
      </label>

      <label>
        Observaciones:
        <textarea :value="selectedNiche.observaciones || '-'" readonly></textarea>
      </label>
    </div>

    <div v-else-if="selectedLot" class="selection-details">
      <label>
        Sección:
        <input :value="selectedLot.seccionId" readonly />
      </label>

      <label>
        Manzana:
        <input :value="selectedLot.manzanaId" readonly />
      </label>

      <label>
        Lote:
        <input :value="selectedLot.id" readonly />
      </label>

      <label>
        Estado de Venta:
        <input :value="selectedLot.estatus_venta" readonly />
        <input :value="selectedLot.estatus_ocupacion || '-'" readonly />
      </label>

      <label>
        Referencia ProcaP:
        <input :value="selectedLot.referencia_procap || '-'" readonly />
      </label>

      <label>
        Observaciones:
        <textarea :value="selectedLot.observaciones || '-'" readonly></textarea>
      </label>
    </div>

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

.selection-details {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-top: 10px;
}

.selection-details label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-weight: 600;
}

.selection-details input {
  width: 100%;
  padding: 0.6rem;
  box-sizing: border-box;

  border: 1px solid var(--color-border);
  border-radius: 4px;
  background-color: var(--color-background);
  color: var(--color-text);
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
</style>
