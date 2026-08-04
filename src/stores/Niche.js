import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useNicheStore = defineStore('niche', () => {
  const selectedZone = ref(null)

  const selectedSide = ref('concavo')

  const selectedNiche = ref(null)

  const canGoBack = computed(() => selectedZone.value !== null)

  function goBack() {
    if (selectedNiche.value !== null) {
      clearSelectedNiche()
      return
    }

    clearZone()
  }

  function selectSide(side) {
    selectedSide.value = side
  }

  function selectZone(zone) {
    selectedZone.value = zone
    selectedSide.value = 'concavo'
  }

  function selectNiche(niche) {
    console.log('Store:', niche)
    selectedNiche.value = niche
  }

  function clearSelectedNiche() {
    selectedNiche.value = null
  }

  function clearZone() {
    selectedZone.value = null
    selectedSide.value = 'concavo'
    clearSelectedNiche()
  }

  return {
    selectedZone,
    selectedSide,
    selectedNiche,
    canGoBack,
    //----------------------
    selectSide,
    selectZone,
    selectNiche,
    clearSelectedNiche,
    clearZone,
    goBack,
  }
})
