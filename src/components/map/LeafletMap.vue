<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import Leaf from 'leaflet'

import 'leaflet/dist/leaflet.css'
import {useSelectionStore} from '@/stores/Selection'

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
const selectionStore = useSelectionStore()


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
const sections = ref(null)
const blocks = ref(null)
const lots = ref(null)

const sectionLayer = ref(null)
const blockLayer = ref(null)
const lotLayer = ref(null)

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
    
    // Se cargan las geometrías de las secciones, bloques y lotes
    // dinamicamente desde el servicio GeometryService y se crean 
    // las capas correspondientes.
    // -----------------------------------------------------
    sections.value = await GeometryService.getSections()
    blocks.value = await GeometryService.getBlocks()
    lots.value = await GeometryService.getLots()

    lotLayer.value = createLotLayer(lots.value, 'var(--color-lot-outline)')


    sectionLayer.value = createSectionLayer(
        sections.value, 
        'var(--color-section-outline)',
        (sectionId) => {
            selectionStore.selectSection(sectionId)

            const filteredBlocks = {
                type: 'FeatureCollection',
                features: blocks.value.features.filter(
                    (block) => block.properties.seccion === sectionId
                )
            }

            sectionLayer.value.remove()
            
            blockLayer.value = createBlockLayer(
                filteredBlocks, 
                'var(--color-block-outline)', 
                mapInstance.value
            )
            blockLayer.value.addTo(mapInstance.value)

            console.log(`Seccion seleccionada: ${sectionId}`)
        }
    )
    sectionLayer.value.addTo(mapInstance.value)

    
    

    
    
    

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