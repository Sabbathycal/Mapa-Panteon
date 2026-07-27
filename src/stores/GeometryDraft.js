import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useGeometryDraftStore = defineStore('geometryDraft', () => {
  const featureCollection = ref({
    type: 'FeatureCollection',
    features: [],
  })

  const featureCount = computed(() => featureCollection.value.features.length)

  function setFeatureCollection(newFeatureCollection) {
    featureCollection.value = newFeatureCollection
  }

  function clearDraft() {
    featureCollection.value = {
      type: 'FeatureCollection',
      features: [],
    }
  }

  return {
    featureCollection,
    featureCount,
    //-----------------
    setFeatureCollection,
    clearDraft,
  }
})
