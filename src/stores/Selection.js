import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

const selectedLotStatus = ref(null)

export const useSelectionStore = defineStore('selection', () => {
  const selectedSectionId = ref(null)
  const selectedBlockId = ref(null)
  const selectedLotId = ref(null)

  const areLotsVisible = ref(false)
  const activeLotFilter = ref('todos')

  function selectSection(sectionId) {
    selectedSectionId.value = sectionId
    selectedBlockId.value = null
    selectedLotId.value = null
    selectedLotStatus.value = null
    areLotsVisible.value = false
    activeLotFilter.value = 'todos'
  }

  function selectBlock(blockId) {
    selectedBlockId.value = blockId
    selectedLotId.value = null
    selectedLotStatus.value = null
    areLotsVisible.value = false
    activeLotFilter.value = 'todos'
  }

  function selectLot(lotId, lotStatus) {
    selectedLotId.value = lotId
    selectedLotStatus.value = lotStatus
  }

  function selectLotFilter(filterId) {
    activeLotFilter.value = filterId
  }

  function showLots() {
    if (selectedBlockId.value === null) return

    areLotsVisible.value = true
  }

  function hideLots() {
    areLotsVisible.value = false
    selectedLotId.value = null
    selectedLotStatus.value = null
  }

  function toggleLotsVisibility() {
    if (areLotsVisible.value) {
      hideLots()
      return
    }

    showLots()
  }

  function clearSelection() {
    selectedSectionId.value = null
    selectedBlockId.value = null
    selectedLotId.value = null
    selectedLotStatus.value = null
    areLotsVisible.value = false
    activeLotFilter.value = 'todos'
  }

  const canGoBack = computed(() => selectedSectionId.value !== null)

  function goBack() {
    if (selectedLotId.value !== null) {
      selectedLotId.value = null
      selectedLotStatus.value = null
      return
    }

    if (selectedBlockId.value !== null) {
      selectedBlockId.value = null
      areLotsVisible.value = false
      return
    }

    clearSelection()
  }

  return {
    selectedSectionId,
    selectedBlockId,
    selectedLotId,
    selectedLotStatus,
    areLotsVisible,
    activeLotFilter,
    canGoBack,
    //-----------------
    selectSection,
    selectBlock,
    selectLot,
    showLots,
    hideLots,
    toggleLotsVisibility,
    selectLotFilter,
    clearSelection,
    goBack,
  }
})
