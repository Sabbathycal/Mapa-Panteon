import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSidebarStore = defineStore('sidebar', () => {
  const activeView = ref('info')
  const isOpen = ref(false)

  function openSidebar() {
    isOpen.value = true
  }

  function closeSidebar() {
    isOpen.value = false
  }

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
    isOpen,
    //-------------------
    openSidebar,
    closeSidebar,
    showInfo,
    showAdmin,
    resetView,
  }
})
