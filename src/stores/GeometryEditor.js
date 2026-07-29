import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useGeometryEditorStore = defineStore('geometryEditor', () => {
  const selectedTool = ref('grid')

  const geometryType = ref(null)

  function selectGeometryType(type) {
    geometryType.value = type
  }

  function selectTool(tool) {
    selectedTool.value = tool
  }

  const isDrawing = computed(() => selectedTool.value === 'draw')
  const isEditing = computed(() => selectedTool.value === 'edit')
  const isGrid = computed(() => selectedTool.value === 'grid')

  return {
    selectedTool,
    geometryType,
    isDrawing,
    isEditing,
    isGrid,
    //---------------
    selectTool,
    selectGeometryType,
  }
})
