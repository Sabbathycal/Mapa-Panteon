import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const isAdminMode = ref(false)

  function toggleAdminMode() {
    isAdminMode.value = !isAdminMode.value
  }

  return {
    isAdminMode,
    //--------------------
    toggleAdminMode,
  }
})
