import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

const selectedLotStatus = ref(null)

export const useSelectionStore = defineStore('selection', () => {
  const selectedSectionId = ref(null)
  const selectedBlockId = ref(null)
  const selectedLotId = ref(null)

  function selectSection(sectionId) {
    selectedSectionId.value = sectionId
    selectedBlockId.value = null
    selectedLotId.value = null
    selectedLotStatus.value = null
  }

  function selectBlock(blockId) {
    selectedBlockId.value = blockId
    selectedLotId.value = null
    selectedLotStatus.value = null
  }

  function selectLot(lotId, lotStatus) {
    selectedLotId.value = lotId
    selectedLotStatus.value = lotStatus
  }

  function clearSelection() {
    selectedSectionId.value = null
    selectedBlockId.value = null
    selectedLotId.value = null
    selectedLotStatus.value = null
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
      return
    }

    clearSelection()
  }

  return {
    selectedSectionId,
    selectedBlockId,
    selectedLotId,
    selectedLotStatus,
    canGoBack,
    //-----------------
    selectSection,
    selectBlock,
    selectLot,
    clearSelection,
    goBack,
  }
})
