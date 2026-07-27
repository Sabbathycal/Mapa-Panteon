import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useGridEditorStore = defineStore('gridEditor', () => {
  const rows = ref(1)
  const columns = ref(1)

  const cellWidth = ref(20)
  const cellHeight = ref(20)

  const spacingX = ref(0)
  const spacingY = ref(0)

  const rotation = ref(0)
  const startNumber = ref(1)

  const generateRequest = ref(0)

  function requestGridGeneration() {
    generateRequest.value++
  }

  function resetGrid() {
    rows.value = 1
    columns.value = 1

    cellWidth.value = 20
    cellHeight.value = 20

    spacingX.value = 0
    spacingY.value = 0

    rotation.value = 0
    startNumber.value = 1
  }

  return {
    rows,
    columns,
    cellWidth,
    cellHeight,
    spacingX,
    spacingY,
    rotation,
    startNumber,
    generateRequest,
    //-----------------
    resetGrid,
    requestGridGeneration,
  }
})
