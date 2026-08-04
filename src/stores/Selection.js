import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

const selectedLotStatus = ref(null)

export const useSelectionStore = defineStore('selection', () => {
  const selectedSectionId = ref(null)
  const selectedBlockId = ref(null)
  const selectedLotId = ref(null)

  const areLotsVisible = ref(false)

  function selectSection(sectionId) {
    selectedSectionId.value = sectionId
    selectedBlockId.value = null
    selectedLotId.value = null
    selectedLotStatus.value = null
    areLotsVisible.value = false
  }

  function selectBlock(blockId) {
    selectedBlockId.value = blockId
    selectedLotId.value = null
    selectedLotStatus.value = null
    areLotsVisible.value = false
  }

  function selectLot(lotId, lotStatus) {
    selectedLotId.value = lotId
    selectedLotStatus.value = lotStatus
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
    canGoBack,
    //-----------------
    selectSection,
    selectBlock,
    selectLot,
    showLots,
    hideLots,
    toggleLotsVisibility,
    clearSelection,
    goBack,
  }
})
