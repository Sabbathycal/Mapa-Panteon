import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useGeometryEditorStore = defineStore('geometryEditor', () => {
  const selectedTool = ref('select')

  function selectTool(tool) {
    selectedTool.value = tool
  }

  const isSelecting = computed(() => selectedTool.value === 'select')
  const isDrawing = computed(() => selectedTool.value === 'draw')
  const isEditing = computed(() => selectedTool.value === 'edit')
  const isDeleting = computed(() => selectedTool.value === 'delete')

  return {
    selectedTool,
    isSelecting,
    isDrawing,
    isEditing,
    isDeleting,
    selectTool,
  }
})
