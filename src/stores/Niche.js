import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useNicheStore = defineStore('niche', () => {
  const selectedZone = ref(null)

  const selectedSide = ref('concavo')

  function selectSide(side) {
    selectedSide.value = side
  }

  function selectZone(zone) {
    selectedZone.value = zone
    selectedSide.value = 'concavo'
  }

  function clearZone() {
    selectedZone.value = null
    selectedSide.value = 'concavo'
  }

  return {
    selectedZone,
    selectedSide,
    //----------------------
    selectSide,
    selectZone,
    clearZone,
  }
})
