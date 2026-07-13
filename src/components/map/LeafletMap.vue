<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import Leaf from 'leaflet'

import 'leaflet/dist/leaflet.css'

import mapImage from '@/assets/images/map/base.png'

const mapContainer = ref(null)

const mapInstance = ref(null)

function loadImageDimensions(imageSource) {
    return new Promise((resolve,reject) => {
        const image = new Image()

        image.onload = () => {
            resolve({
                width: image.naturalWidth,
                height: image.naturalHeight,
            })
        }

        image.onerror = () => {
            reject(new Error('No fue posible cargar la imagen base del mapa.'))
        }

        image.src = imageSource
    })
}

onMounted(async() => {
    if (!mapContainer.value) return


    mapInstance.value = Leaf.map(mapContainer.value, {
        crs: Leaf.CRS.Simple,
        minZoom: -3, // Que tanto zoom out se puede hacer en el mapa, se quedara asi
                    // esto para que se pueda visualizar gran parte del mapa, menos abrumante
        maxZoom: 4,
        attributionControl: false,
    })

    try {
        const {width, height} = await loadImageDimensions(mapImage)
    

    const imageBounds = [
        [0, 0],
        [height, width], 
    ]

    Leaf.imageOverlay(mapImage, imageBounds).addTo(mapInstance.value)

    mapInstance.value.fitBounds(imageBounds)
    mapInstance.value.setMaxBounds(imageBounds)
    } catch (error) {
        console.error(error)
    }
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