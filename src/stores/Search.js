import { defineStore } from 'pinia'
import { ref } from 'vue'

import { PropertySearchService } from '@/services/search/PropertySearchService'
import { useSelectionStore } from '@/stores/Selection'

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

  function searchLots(lotFeatures, options = {}) {
    const normalizedQuery = PropertySearchService.normalizeSearchValue(query.value)

    if (!normalizedQuery) {
      clearResults()
      return
    }

    isSearching.value = true

    try {
      results.value = PropertySearchService.searchLots(lotFeatures, query.value, options)

      isOpen.value = true
    } finally {
      isSearching.value = false
    }
  }

  function selectResult(result) {
    if (!result || result.tipo !== 'lote') {
      return
    }

    const selectionStore = useSelectionStore()

    selectionStore.selectSection(result.seccionId)
    selectionStore.selectBlock(result.manzanaId)
    selectionStore.selectLot(result.loteId, result.estatus)

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
    searchLots,
    selectResult,
    clearResults,
    clearSearch,
    openResults,
    closeResults,
  }
})
