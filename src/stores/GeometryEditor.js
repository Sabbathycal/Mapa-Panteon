import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useGeometryEditorStore = defineStore('geometryEditor', () => {
  const selectedTool = ref('select')

  const geometryType = ref(null)

  function selectGeometryType(type) {
    geometryType.value = type
  }

  function selectTool(tool) {
    selectedTool.value = tool
  }

  const isSelecting = computed(() => selectedTool.value === 'select')
  const isDrawing = computed(() => selectedTool.value === 'draw')
  const isEditing = computed(() => selectedTool.value === 'edit')
  const isDeleting = computed(() => selectedTool.value === 'delete')
  const isGrid = computed(() => selectedTool.value === 'grid')

  return {
    selectedTool,
    geometryType,
    isSelecting,
    isDrawing,
    isEditing,
    isDeleting,
    isGrid,
    //---------------
    selectTool,
    selectGeometryType,
  }
})
