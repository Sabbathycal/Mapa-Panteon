<script setup>
import { computed } from 'vue'
import { useNicheStore } from '@/stores/Niche'

import NicheLeafletMap from '@/components/map/NicheLeafletMap.vue'

import spnConcaveImage from '@/assets/images/nichos/normalizadas/SPN-concavo.png'
import plnConcaveImage from '@/assets/images/nichos/normalizadas/PLN-concavo.png'
import plnConvexImage from '@/assets/images/nichos/normalizadas/PLN-convexo.png'

const nicheStore = useNicheStore()

const nicheImages = {
  SPN: {
    concavo: spnConcaveImage,
  },
  PLN: {
    concavo: plnConcaveImage,
    convexo: plnConvexImage,
  },
}

const selectedImage = computed(() => {
  const zoneId = nicheStore.selectedZone?.id
  const selectedSide = nicheStore.selectedSide

  return nicheImages[zoneId]?.[selectedSide] ?? null
})

const hasConvexImage = computed(() => {
  const zoneId = nicheStore.selectedZone?.id

  return Boolean(nicheImages[zoneId]?.convexo)
})
</script>

<template>
  <section class="niche-map-view">
    <!--Titulo de Nicho-->
    <h2>{{ nicheStore.selectedZone?.nombre }} - {{ nicheStore.selectedZone?.id }}</h2>

    <!--SOLO SALE SI NO HAY IMAGEN CONVEXA - En este caso SPN no tiene CONVEXA-->
    <p v-if="!hasConvexImage" class="missing-image-msg">
      La vista convexa de esta zona todavia no esta disponible.
    </p>

    <!--Mapa Leaflet de Nichos-->
    <NicheLeafletMap
      v-if="selectedImage"
      :key="`${nicheStore.selectedZone?.id}-${nicheStore.selectedSide}`"
      :image-source="selectedImage"
    />

    <p v-else>No fue posible encontrar la imagen de la zona.</p>
  </section>
</template>

<style scoped>
.niche-map-view {
  width: 100%;
  height: 100%;
  padding: 1rem;
  box-sizing: border-box;
  overflow: auto;
}

@media (max-width: 768px) {
  .back-button,
  .missing-image-msg {
    display: none;
  }

  .niche-map-view {
    padding: 0;
    overflow: hidden;
  }

  .niche-map-view > h2 {
    display: none;
  }
}
</style>
