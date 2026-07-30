<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Leaf from 'leaflet'

import 'leaflet/dist/leaflet.css'
import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'

import { createNicheLayer } from './layers/NicheLayer'

import { useAuthStore } from '@/stores/Auth'
import { useGeometryEditorStore } from '@/stores/GeometryEditor'
import { useGridEditorStore } from '@/stores/GridEditorStore'
import { useGeometryDraftStore } from '@/stores/GeometryDraft'

import { GeometryService } from '@/services/geometry/GeometryService'
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

const niches = ref(null)
const nichesLayer = ref(null)

const drawnLayers = ref(null)
const gridLayers = ref(null)

const draggedGridLayer = ref(null)
const previousDragCenter = ref(null)

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

  gridLayers.value?.eachLayer((layer) => {
    layer.pm.disableLayerDrag()
  })

  if (authStore.isAdminMode && geometryEditorStore.isEditing) {
    enableGridDragging()
  }
}

function generateGrid() {
  if (!mapInstance.value || !gridLayers.value) return

  if (!nicheStore.selectedZone) {
    console.error('No hay una zona de nichos seleccionada.')
    return
  }

  if (!nicheStore.selectedSide) {
    console.error('No hay cara seleccionada.')
    return
  }

  const generateGrid = GridGeneratorService.generateGridFeatureCollection({
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
    zone: nicheStore.selectedZone.id,
    side: nicheStore.selectedSide,
  })

  const rowLabels =
    nicheStore.selectedSide === 'concavo'
      ? ['A', 'B', 'C', 'D', 'E', 'F']
      : ['AX', 'BX', 'CX', 'DX', 'EX', 'FX']

  const featureCollection = {
    type: 'FeatureCollection',

    features: generateGrid.features.map((feature) => {
      const rowIndex = feature.properties.row
      const columnIndex = feature.properties.column

      const rowLabel = rowLabels[rowIndex]

      const number = gridEditorStore.startNumber + columnIndex

      const niche = createNicheGeometry(feature, {
        zoneId: nicheStore.selectedZone.id,
        side: nicheStore.selectedSide,
        row: rowLabel,
        number,
      })

      return {
        type: 'Feature',

        properties: {
          id: niche.id,
          tipo: niche.tipo,

          zonaId: niche.zonaId,
          cara: niche.cara,

          fila: niche.fila,
          numero: niche.numero,
          codigo: niche.codigo,

          estatus_venta: niche.estatus_venta,
          estatus_ocupacion: niche.estatus_ocupacion,

          referencia_procap: niche.referencia_procap,
          observaciones: niche.observaciones,

          geometryType: feature.properties.geometryType,

          gridRow: rowIndex,
          gridColumn: columnIndex,
        },

        geometry: feature.geometry,
      }
    }),
  }

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

  if (geometryEditorStore.isEditing) {
    enableGridDragging()
  }

  console.log('Cuadricula de nichos GeoJSON:', featureCollection)
}

function enableGridDragging() {
  if (!gridLayers.value) return

  gridLayers.value.eachLayer((layer) => {
    layer.pm.enableLayerDrag()

    layer.on('pm:dragstart', () => {
      draggedGridLayer.value = layer
      previousDragCenter.value = layer.getBounds().getCenter()
    })

    layer.on('pm:drag', () => {
      if (!draggedGridLayer.value || !previousDragCenter.value) {
        return
      }

      const currentCenter = draggedGridLayer.value.getBounds().getCenter()

      const latDifference = currentCenter.lat - previousDragCenter.value.lat

      const lngDifference = currentCenter.lng - previousDragCenter.value.lng

      gridLayers.value.eachLayer((gridLayer) => {
        if (gridLayer === draggedGridLayer.value) return

        const movedCoordinates = gridLayer
          .getLatLngs()[0]
          .map((latLng) => [latLng.lat + latDifference, latLng.lng + lngDifference])

        gridLayer.setLatLngs(movedCoordinates)
      })

      previousDragCenter.value = currentCenter
    })

    layer.on('pm:dragend', () => {
      syncGridDraftFromLayers()

      draggedGridLayer.value = null
      previousDragCenter.value = null
    })
  })
}

function syncGridDraftFromLayers() {
  if (!gridLayers.value) return

  const originalFeatures = geometryDraftStore.featureCollection.features

  const features = []

  let index = 0

  gridLayers.value.eachLayer((layer) => {
    const updatedFeature = layer.toGeoJSON()
    const originalFeature = originalFeatures[index]

    updatedFeature.properties = {
      ...originalFeature?.properties,
    }

    features.push(updatedFeature)
    index++
  })

  geometryDraftStore.setFeatureCollection({
    type: 'FeatureCollection',
    features,
  })
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

  try {
    const zoneId = nicheStore.selectedZone?.id
    const side = nicheStore.selectedSide

    if (!zoneId || !side) {
      throw new Error('No hay una zona o cara de nichos seleccionada')
    }

    niches.value = await GeometryService.getNiches(zoneId, side)

    nichesLayer.value = createNicheLayer(niches.value, (niche) => {
      console.log('Nicho seleccionado:', niche)
    })

    nichesLayer.value.addTo(mapInstance.value)
  } catch (error) {
    console.error('No fue posible cargar la geometría de los nichos:', error)
  }

  mapInstance.value.on('pm:create', (event) => {
    if (!nicheStore.selectedZone) {
      console.error('No hay una zona de nichos seleccionada.')
      event.layer.remove()
      return
    }

    drawnLayers.value.addLayer(event.layer)

    const geojson = event.layer.toGeoJSON()

    const newNiche = createNicheGeometry(geojson, {
      zoneId: nicheStore.selectedZone.id,
      side: nicheStore.selectedSide,
    })

    console.log('Nicho manual creado: ', newNiche)
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
