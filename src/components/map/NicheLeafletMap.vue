<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Leaf from 'leaflet'

import 'leaflet/dist/leaflet.css'
import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'

import { useAuthStore } from '@/stores/Auth'
import { useGeometryEditorStore } from '@/stores/GeometryEditor'
import { useGridEditorStore } from '@/stores/GridEditorStore'
import { useGeometryDraftStore } from '@/stores/GeometryDraft'

import { GridGeneratorService } from '@/services/geometry/GridGeneratorService'

import { createNicheGeometry } from '@/services/niche/NicheGeometryService'
import { useNicheStore } from '@/stores/Niche'

const nicheStore = useNicheStore()

const props = defineProps({
  imageSource: {
    type: String,
    required: true,
  },
})

const authStore = useAuthStore()
const geometryEditorStore = useGeometryEditorStore()
const gridEditorStore = useGridEditorStore()
const geometryDraftStore = useGeometryDraftStore()

const mapContainer = ref(null)
const mapInstance = ref(null)
const drawnLayers = ref(null)
const gridLayers = ref(null)

function loadImageDimensions(imageSource) {
  return new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = () => {
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
      })
    }

    image.onerror = () => {
      reject(new Error('No fue posible cargar la imagen del mapa de nichos.'))
    }

    image.src = imageSource
  })
}

function updateEditorTool() {
  if (!mapInstance.value) return

  mapInstance.value.pm.disableDraw()

  if (authStore.isAdminMode && geometryEditorStore.isDrawing) {
    mapInstance.value.pm.enableDraw('Polygon', {
      snappable: true,
      allowSelfIntersection: false,

      pathOptions: {
        color: '#f4b805',
        fillColor: '#f4b805',
        fillOpacity: 0.25,
        weight: 2,
      },
    })
  }
}

function generateGrid() {
  if (!mapInstance.value || !gridLayers.value) return

  const featureCollection = GridGeneratorService.generateGridFeatureCollection({
    center: mapInstance.value.getCenter(),

    rows: gridEditorStore.rows,
    columns: gridEditorStore.columns,

    cellWidth: gridEditorStore.cellWidth,
    cellHeight: gridEditorStore.cellHeight,

    spacingX: gridEditorStore.spacingX,
    spacingY: gridEditorStore.spacingY,

    rotation: gridEditorStore.rotation,
    startNumber: gridEditorStore.startNumber,

    geometryType: 'niches',
    zone: nicheStore.selectedZone?.id ?? null,
    side: nicheStore.selectedSide,
  })

  geometryDraftStore.setFeatureCollection(featureCollection)

  gridLayers.value.clearLayers()

  Leaf.geoJSON(geometryDraftStore.featureCollection, {
    style: {
      color: '#f4b805',
      fillColor: '#f4b805',
      fillOpacity: 0.25,
      weight: 1,
    },
  }).eachLayer((layer) => {
    gridLayers.value.addLayer(layer)
  })

  console.log('Cuadricula GeoJSON:', featureCollection)
}

onMounted(async () => {
  if (!mapContainer.value) return

  geometryEditorStore.selectGeometryType('niches')

  mapInstance.value = Leaf.map(mapContainer.value, {
    crs: Leaf.CRS.Simple,
    minZoom: 0,
    maxZoom: 1,
    attributionControl: false,
  })

  drawnLayers.value = Leaf.featureGroup().addTo(mapInstance.value)

  gridLayers.value = Leaf.featureGroup().addTo(mapInstance.value)

  try {
    const { width, height } = await loadImageDimensions(props.imageSource)

    const imageBounds = [
      [0, 0],
      [height, width],
    ]

    Leaf.imageOverlay(props.imageSource, imageBounds).addTo(mapInstance.value)

    mapInstance.value.fitBounds(imageBounds)
    mapInstance.value.setMaxBounds(imageBounds)
  } catch (error) {
    console.error(error)
  }

  mapInstance.value.on('pm:create', (event) => {
    if (!nicheStore.selectedZone) {
      console.error('No hay una zona de nichos seleccionada.')
      event.layer.remove()
      return
    }

    drawnLayers.value.addLayer(event.layer)

    const geojson = event.layer.toGeoJSON()

    const newNiche = createNicheGeometry(
      geojson,
      nicheStore.selectedZone.id,
      nicheStore.selectedSide,
    )

    console.log('Nicho temporal creado: ', newNiche)
  })

  updateEditorTool()
})

watch(() => [authStore.isAdminMode, geometryEditorStore.selectedTool], updateEditorTool)

watch(
  () => gridEditorStore.generateRequest,
  () => {
    if (geometryEditorStore.geometryType === 'niches') {
      generateGrid()
    }
  },
)

watch(
  () => geometryDraftStore.featureCount,
  (newCount) => {
    if (newCount === 0) {
      gridLayers.value?.clearLayers()
    }
  },
)

onBeforeUnmount(() => {
  mapInstance.value?.pm.disableDraw()
  mapInstance.value?.remove()
  mapInstance.value = null
  drawnLayers.value = null
  gridLayers.value = null
})
</script>

<template>
  <div ref="mapContainer" class="niche-leaflet-map"></div>
</template>

<style scoped>
.niche-leaflet-map {
  width: 100%;
  height: 70vh;
  min-height: 500px;
  background-color: var(--color-background);
}
</style>
