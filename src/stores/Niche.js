import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useNicheStore = defineStore('niche', () => {
  const selectedZone = ref(null)

  function selectZone(zone) {
    selectedZone.value = zone
  }

  function clearZone() {
    selectedZone.value = null
  }

  return {
    selectedZone,
    //----------------------
    selectZone,
    clearZone,
  }
})
