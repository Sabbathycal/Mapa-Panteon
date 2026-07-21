<script setup>
import LeafletMap from '@/components/map/LeafletMap.vue'
import NichoMapView from '@/views/NichoMapView.vue'
import { useNicheStore } from '@/stores/Niche'

const nicheStore = useNicheStore()
</script>

<template>
  <div class="map-view">
    <NichoMapView v-if="nicheStore.selectedZone" />
    <LeafletMap v-else />
  </div>
</template>

<style scoped>
.map-view {
  width: 100%;
  height: 100%;
}
</style>
