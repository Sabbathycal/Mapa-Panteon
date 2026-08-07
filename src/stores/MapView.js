import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useMapViewStore = defineStore('mapView', () => {
  const resetRequest = ref(0)

  function requestResetMap() {
    resetRequest.value++
  }

  return {
    resetRequest,
    requestResetMap,
  }
})
