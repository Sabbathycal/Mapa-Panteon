import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useNicheStore = defineStore('niche', () => {
  const selectedZone = ref(null)

  const selectedSide = ref('concavo')

  const selectedNiche = ref(null)
  const activeNicheFilter = ref('todos')

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
    selectedNiche.value = null
    activeNicheFilter.value = 'todos'
  }

  function selectZone(zone) {
    selectedZone.value = zone
    selectedSide.value = 'concavo'
    selectedNiche.value = null
    activeNicheFilter.value = 'todos'
  }

  function selectNiche(niche) {
    console.log('Store:', niche)
    selectedNiche.value = niche
  }

  function selectNicheFilter(filterId) {
    activeNicheFilter.value = filterId
  }

  function clearSelectedNiche() {
    selectedNiche.value = null
  }

  function clearZone() {
    selectedZone.value = null
    selectedSide.value = 'concavo'
    activeNicheFilter.value = 'todos'
    clearSelectedNiche()
  }

  return {
    selectedZone,
    selectedSide,
    selectedNiche,
    activeNicheFilter,
    canGoBack,
    //----------------------
    selectSide,
    selectZone,
    selectNiche,
    selectNicheFilter,
    clearSelectedNiche,
    clearZone,
    goBack,
  }
})
