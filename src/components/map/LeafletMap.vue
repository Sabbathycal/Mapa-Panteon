<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import Leaf from 'leaflet'

import 'leaflet/dist/leaflet.css'

const mapContainer = ref(null)

const mapInstance = ref(null)

onMounted(() => {
    if (!mapContainer.value) return

    mapInstance.value = Leaf.map(mapContainer.value, {
        crs: Leaf.CRS.Simple,
        minZoom: -2,
        maxZoom: 4,
        attributionControl: false,
    })

    mapInstance.value.setView([0, 0], 0)
})

onBeforeUnmount(() => {
    mapInstance.value?.remove()
    mapInstance.value = null  
})
</script>

<template>
    <div ref="mapContainer" class="leaflet-map"></div>
</template>

<style scoped>
.leaflet-map {
    width: 100%;
    height: 100%;
    min-height: 500px;
    background-color: var(--color-background);
}
</style>