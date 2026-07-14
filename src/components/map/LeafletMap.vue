<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import Leaf from 'leaflet'

import 'leaflet/dist/leaflet.css'

//imagen del mapa base del panteon
import mapImage from '@/assets/images/map/base.png'

//Geometria para mapa del panteon
import {GeometryService} from '@/services/geometry/GeometryService'
import {createSectionLayer} from '@/components/map/layers/SectionLayer'
import {createBlockLayer} from '@/components/map/layers/BlockLayer'
import {createLotLayer} from '@/components/map/layers/LotLayer'


//Estas constantes son para poder manipular el mapa y sus elementos
const mapContainer = ref(null)
const mapInstance = ref(null)


// Esta funcion es para poder obtener las dimensiones de la imagen del
// mapa base
function loadImageDimensions(imageSource) {
    return new Promise((resolve,reject) => {
        const image = new Image()

        // Cuando la imagen se carga, se resuelve la promesa 
        // con sus dimensiones
        image.onload = () => {
            resolve({
                width: image.naturalWidth,
                height: image.naturalHeight,
            })
        }

        // Si hay un error al cargar la imagen, se rechaza 
        // la promesa con un error
        image.onerror = () => {
            reject(new Error('No fue posible cargar la imagen base del mapa.'))
        }

        image.src = imageSource
    })
}

// Esta funcion se ejecuta cuando el componente se monta, y es 
// la que inicializa el mapa
onMounted(async() => {
    if (!mapContainer.value) return

    // Se crea la instancia del mapa con las opciones necesarias
    mapInstance.value = Leaf.map(mapContainer.value, {
        crs: Leaf.CRS.Simple,
        minZoom: -3,    //NO MODIFICAR 
                        // Que tanto zoom out se puede hacer en 
                        // el mapa, se quedara asi.
                        // Esto para que se pueda visualizar gran
                        // parte del mapa, menos abrumante

        maxZoom: 1,     // Que tanto zoom in se puede hacer en el mapa
        attributionControl: false,
    })


    // Se cargan las dimensiones de la imagen del mapa base y 
    // se crean los bounds
    try {
        const {width, height} = await loadImageDimensions(mapImage)
    

    const imageBounds = [
        [0, 0],
        [height, width], 
    ]

    // Se agrega la imagen del mapa base al mapa y se 
    // ajusta el zoom y los bounds.
    Leaf.imageOverlay(mapImage, imageBounds).addTo(mapInstance.value)

    // Se ajusta el zoom y los bounds del mapa para que se 
    // vea la imagen completa y no se pueda hacer zoom fuera 
    // de los bounds.
    mapInstance.value.fitBounds(imageBounds)
    mapInstance.value.setMaxBounds(imageBounds)
    } catch (error) {
        console.error(error)
    }
    
    // Estas constantes son para poder agregar las geometrías 
    // de secciones y bloques al mapa.
    // -----------------------------------------------------
    const sections = await GeometryService.getSections()
    const sectionLayer = createSectionLayer(sections, 'var(--color-section-outline)')
    sectionLayer.addTo(mapInstance.value)

    const blocks = await GeometryService.getBlocks()
    const blockLayer = createBlockLayer(blocks, 'var(--color-block-outline)', mapInstance.value)
    blockLayer.addTo(mapInstance.value)

    const lots = await GeometryService.getLots()
    const lotLayer = createLotLayer(lots, 'var(--color-lot-outline)')
    lotLayer.addTo(mapInstance.value)

    // -----------------------------------------------------

})


// Esta funcion se ejecuta cuando el componente se desmonta, y es
// la que elimina la instancia del mapa y libera los recursos.
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