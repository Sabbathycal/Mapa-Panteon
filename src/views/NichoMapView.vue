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
    <button type="button" @click="nicheStore.clearZone" class="back-button">
      ← Volver al mapa
    </button>
    <h2>{{ nicheStore.selectedZone?.nombre }}</h2>

    <p>
      <strong>Zona seleccionada:</strong>
      {{ nicheStore.selectedZone?.id }}
    </p>

    <div class="side-selector">
      <button
        type="button"
        class="concave-button"
        :class="{
          active: nicheStore.selectedSide === 'concavo',
        }"
        :disabled="nicheStore.selectedSide === 'concavo'"
        @click="nicheStore.selectSide('concavo')"
      >
        Cóncavo
      </button>

      <button
        type="button"
        class="convex-button"
        :class="{
          active: nicheStore.selectedSide === 'convexo',
        }"
        :disabled="!hasConvexImage || nicheStore.selectedSide === 'convexo'"
        @click="nicheStore.selectSide('convexo')"
      >
        Convexo
      </button>
    </div>

    <p v-if="!hasConvexImage" class="missing-image-msg">
      La vista convexa de esta zona todavia no esta disponible.
    </p>

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
</style>
