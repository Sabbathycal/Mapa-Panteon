import { defineStore } from 'pinia'
import { ref } from 'vue'

import { PropertySearchService } from '@/services/search/PropertySearchService'
import { useSelectionStore } from '@/stores/Selection'
import { useNicheStore } from './Niche'

export const useSearchStore = defineStore('search', () => {
  const query = ref('')
  const results = ref([])
  const isOpen = ref(false)
  const isSearching = ref(false)

  function setQuery(value) {
    query.value = value
  }

  function clearResults() {
    results.value = []
    isOpen.value = false
  }

  function clearSearch() {
    query.value = ''
    clearResults()
  }

  function searchProperties(lotFeatures, nicheFeatures, options = {}) {
    const normalizedQuery = PropertySearchService.normalizeSearchValue(query.value)

    if (!normalizedQuery) {
      clearResults()
      return
    }

    isSearching.value = true

    try {
      results.value = PropertySearchService.searchProperties(
        lotFeatures,
        nicheFeatures,
        query.value,
        options,
      )

      isOpen.value = true
    } finally {
      isSearching.value = false
    }
  }

  function selectResult(result) {
    if (!result) return

    const selectionStore = useSelectionStore()
    const nicheStore = useNicheStore()

    if (result.tipo === 'lote') {
      nicheStore.clearZone()

      selectionStore.selectSection(result.seccionId)
      selectionStore.selectBlock(result.manzanaId)
      selectionStore.showLots()
      selectionStore.selectLot(result.loteId, result.estatus)
    }

    if (result.tipo === 'nicho') {
      selectionStore.clearSelection()

      nicheStore.selectZone({
        id: result.zonaId,
        nombre: result.zonaId,
      })

      nicheStore.selectSide(result.cara)
      nicheStore.selectNiche(result.feature.properties)
    }

    query.value = result.titulo
    isOpen.value = false
  }

  function openResults() {
    if (results.value.length > 0) {
      isOpen.value = true
    }
  }

  function closeResults() {
    isOpen.value = false
  }

  return {
    query,
    results,
    isOpen,
    isSearching,
    //--------------------
    setQuery,
    searchProperties,
    selectResult,
    clearResults,
    clearSearch,
    openResults,
    closeResults,
  }
})
