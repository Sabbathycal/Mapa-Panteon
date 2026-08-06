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
const initialNicheMapView = ref(null)

const isLoading = ref(null)
const loadingError = ref(null)

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

function normalizeStatus(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function getNicheStatus(feature) {
  const properties = feature?.properties ?? {}

  const saleStatus = normalizeStatus(properties.estatus_venta)
  const occupationStatus = normalizeStatus(properties.estatus_ocupacion)

  if (occupationStatus === 'ocupado' || saleStatus === 'ocupado') {
    return 'ocupado'
  }

  if (saleStatus === 'separado') return 'separado'
  if (saleStatus === 'vendido') return 'vendido'
  if (saleStatus === 'disponible') return 'disponible'

  return 'sin-estado'
}

function filterNichesByStatus(featureCollection, filterId) {
  if (!featureCollection?.features) {
    return {
      type: 'FeatureCollection',
      features: [],
    }
  }

  if (filterId === 'todos') {
    return featureCollection
  }

  return {
    ...featureCollection,
    features: featureCollection.features.filter((feature) => {
      return getNicheStatus(feature) === filterId
    }),
  }
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

function renderNiches() {
  if (!mapInstance.value || !niches.value) return

  const filteredNiches = filterNichesByStatus(niches.value, nicheStore.activeNicheFilter)

  const selectedNicheId = nicheStore.selectedNiche?.id || nicheStore.selectedNiche?.codigo || null

  nichesLayer.value?.remove()

  nichesLayer.value = createNicheLayer(filteredNiches, selectedNicheId, (niche) => {
    nicheStore.selectNiche(niche)
  })

  nichesLayer.value.addTo(mapInstance.value)
}

function findNicheLayer(nicheId) {
  if (!nichesLayer.value || !nicheId) return null

  let matchingLayer = null

  nichesLayer.value.eachLayer((layer) => {
    const properties = layer.feature?.properties ?? {}
    const layerId = properties.id || properties.codigo

    if (String(layerId) === String(nicheId)) {
      matchingLayer = layer
    }
  })

  return matchingLayer
}

function centerSelectedNiche(nicheId) {
  if (!mapInstance.value) return

  const selectedLayer = findNicheLayer(nicheId)
  const bounds = selectedLayer?.getBounds?.()

  if (!bounds?.isValid()) return

  mapInstance.value.fitBounds(bounds, {
    animate: true,
    duration: 0.45,
    padding: [120, 120],
    maxZoom: 1,
  })
}

function restoreInitialNicheMapView() {
  if (!mapInstance.value || !initialNicheMapView.value) return

  mapInstance.value.setView(initialNicheMapView.value.center, initialNicheMapView.value.zoom, {
    animate: true,
    duration: 0.45,
  })
}

function recenterNicheMap() {
  const selectedNicheId = nicheStore.selectedNiche?.id || nicheStore.selectedNiche?.codigo || null

  if (selectedNicheId) {
    centerSelectedNiche(selectedNicheId)
    return
  }

  restoreInitialNicheMapView()
}

onMounted(async () => {
  if (!mapContainer.value) return

  isLoading.value = true
  loadingError.value = ''

  try {
    geometryEditorStore.selectGeometryType('niches')

    mapInstance.value = Leaf.map(mapContainer.value, {
      crs: Leaf.CRS.Simple,
      minZoom: 0,
      maxZoom: 1,
      attributionControl: false,
    })

    drawnLayers.value = Leaf.featureGroup().addTo(mapInstance.value)
    gridLayers.value = Leaf.featureGroup().addTo(mapInstance.value)

    const { width, height } = await loadImageDimensions(props.imageSource)

    const imageBounds = [
      [0, 0],
      [height, width],
    ]

    Leaf.imageOverlay(props.imageSource, imageBounds).addTo(mapInstance.value)

    mapInstance.value.fitBounds(imageBounds)
    mapInstance.value.setMaxBounds(imageBounds)
    initialNicheMapView.value = {
      center: mapInstance.value.getCenter(),
      zoom: mapInstance.value.getZoom(),
    }

    const zoneId = nicheStore.selectedZone?.id
    const side = nicheStore.selectedSide

    if (!zoneId || !side) {
      throw new Error('No hay una zona o cara de nichos seleccionada')
    }

    niches.value = await GeometryService.getNiches(zoneId, side)

    renderNiches()

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
  } catch (error) {
    console.error('No fue posible cargar el mapa de nichos:', error)

    loadingError.value = 'No fue posible cargar el mapa de nichos.'
  } finally {
    isLoading.value = false
  }
})

watch(() => [authStore.isAdminMode, geometryEditorStore.selectedTool], updateEditorTool)

watch(
  () => nicheStore.activeNicheFilter,
  () => {
    renderNiches()
  },
)

watch(
  () => nicheStore.selectedNiche?.id || nicheStore.selectedNiche?.codigo || null,
  (newNicheId) => {
    if (!mapInstance.value || !niches.value) return

    renderNiches()

    if (newNicheId !== null) {
      centerSelectedNiche(newNicheId)
      return
    }

    restoreInitialNicheMapView()
  },
)

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
  <div class="niche-map-wrapper">
    <div ref="mapContainer" class="niche-leaflet-map"></div>

    <button
      v-if="!isLoading && !loadingError"
      type="button"
      class="recenter-map-button"
      aria-label="Centrar mapa de nichos"
      title="Centrar mapa"
      @click="recenterNicheMap"
    >
      <span aria-hidden="true">◎</span>
    </button>

    <div v-if="isLoading" class="map-loading-overlay">
      <div class="map-loading-card">
        <span class="map-loading-spinner" aria-hidden="true"></span>
        <strong>Cargando mapa de nichos…</strong>
      </div>
    </div>

    <div v-else-if="loadingError" class="map-loading-overlay">
      <div class="map-loading-card map-loading-error">
        <strong>{{ loadingError }}</strong>
      </div>
    </div>
  </div>
</template>

<style scoped>
.niche-map-wrapper {
  position: relative;
  width: 100%;
  height: 70vh;
  min-height: 500px;
}

.niche-leaflet-map {
  width: 100%;
  height: 100%;
  background-color: var(--color-background);
}

.map-loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 1500;

  display: grid;
  place-items: center;

  background-color: rgb(255 255 255 / 72%);
  backdrop-filter: blur(2px);
}

.map-loading-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;

  padding: 0.9rem 1.1rem;

  border: 1px solid var(--color-border);
  border-radius: 10px;

  background-color: var(--color-background);
  box-shadow: 0 4px 16px rgb(0 0 0 / 15%);
}

.map-loading-spinner {
  width: 1.15rem;
  height: 1.15rem;

  border: 3px solid rgb(11 37 69 / 20%);
  border-top-color: #0b2545;
  border-radius: 50%;

  animation: map-loading-spin 0.8s linear infinite;
}

.map-loading-error {
  text-align: center;
}

@keyframes map-loading-spin {
  to {
    transform: rotate(360deg);
  }
}

.recenter-map-button {
  position: absolute;
  top: 5.25rem;
  left: 0.65rem;
  z-index: 1000;

  width: 2rem;
  height: 2rem;
  padding: 0;

  display: grid;
  place-items: center;

  border: 2px solid rgb(0 0 0 / 20%);
  border-radius: 10%;

  background-color: var(--color-background);
  color: var(--color-heading);

  font: inherit;
  font-size: 1.6rem;
  font-weight: 700;
  line-height: 1;

  box-shadow: 0 1px 5px rgb(0 0 0 / 35%);
  cursor: pointer;
}

.recenter-map-button:hover {
  filter: brightness(0.87);
}

.recenter-map-button:active {
  transform: scale(0.95);
}

.recenter-map-button:focus-visible {
  outline: 3px solid var(--color-selection);
  outline-offset: 2px;
}
</style>
