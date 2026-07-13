<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import Leaf from 'leaflet'

import 'leaflet/dist/leaflet.css'

import mapImage from '@/assets/images/map/base.png'

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

    const imageBounds = [
        [0, 0],
        [1000, 1000], 
    ]

    Leaf.imageOverlay(mapImage, imageBounds).addTo(mapInstance.value)

    mapInstance.value.fitBounds(imageBounds)
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
    background-color: var(--color-background);
}
</style>