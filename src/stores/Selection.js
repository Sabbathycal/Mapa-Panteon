import {defineStore} from 'pinia'
import {computed, ref} from 'vue'


export const useSelectionStore = defineStore('selection',() =>{
    const selectedSectionId = ref(null)
    const selectedBlockId = ref(null)
    const selectedLotId = ref(null)

    function selectSection(sectionId) {
        selectedSectionId.value = sectionId
        selectedBlockId.value = null
        selectedLotId.value = null
    }

    function selectBlock(blockId) {
        selectedBlockId.value = blockId
        selectedLotId.value = null
    }

    function selectLot(lotId) {
        selectedLotId.value = lotId
    }

    function clearSelection() {
        selectedSectionId.value = null
        selectedBlockId.value = null
        selectedLotId.value = null
    }

    const canGoBack = computed(() => selectedSectionId.value !== null)

    function goBack() {
    if (selectedBlockId.value !== null) {
        selectedBlockId.value = null
        selectedLotId.value = null
        return
    }

    clearSelection()

}

    return {
        selectedSectionId,
        selectedBlockId,
        selectedLotId,
        canGoBack,
        //-----------------
        selectSection,
        selectBlock,
        selectLot,
        clearSelection,
        goBack
    }

})
