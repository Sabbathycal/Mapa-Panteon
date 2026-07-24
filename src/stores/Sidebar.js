import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSidebarStore = defineStore('sidebar', () => {
  const activeView = ref('info')

  function showInfo() {
    activeView.value = 'info'
  }

  function showAdmin() {
    activeView.value = 'admin'
  }

  function resetView() {
    activeView.value = 'info'
  }

  return {
    activeView,
    //-------------------
    showInfo,
    showAdmin,
    resetView,
  }
})
