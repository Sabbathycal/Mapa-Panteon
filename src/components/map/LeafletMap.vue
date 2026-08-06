<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Leaf from 'leaflet'

import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'

import 'leaflet/dist/leaflet.css'

import { useSelectionStore } from '@/stores/Selection'
import { useNicheStore } from '@/stores/Niche'
import { useAuthStore } from '@/stores/Auth'
import { useGridEditorStore } from '@/stores/GridEditorStore'
import { useGeometryDraftStore } from '@/stores/GeometryDraft'

import mapImage from '@/assets/images/map/base.png'

import { GeometryService } from '@/services/geometry/GeometryService'
import { GridGeneratorService } from '@/services/geometry/GridGeneratorService'

import { useGeometryEditorStore } from '@/stores/GeometryEditor'
import { createSectionLayer } from '@/components/map/layers/SectionLayer'
import { createBlockLayer } from '@/components/map/layers/BlockLayer'
import { createLotLayer } from '@/components/map/layers/LotLayer'
import { createNicheZoneLayer } from '@/components/map/layers/NicheZoneLayer'

import { filterBlockbySection, filterLotsbyBlocks } from '@/utils/geometryFilters'

const mapContainer = ref(null)
const mapInstance = ref(null)
const isLoading = ref(null)
const loadingError = ref('')

const geometryEditorStore = useGeometryEditorStore()
const selectionStore = useSelectionStore()
const nicheStore = useNicheStore()
const authStore = useAuthStore()
const gridEditorStore = useGridEditorStore()
const geometryDraftStore = useGeometryDraftStore()

const gridLayers = ref(null)

const sections = ref(null)
const blocks = ref(null)
const lots = ref(null)
const nicheZones = ref(null)

const sectionLayer = ref(null)
const blockLayer = ref(null)
const lotLayer = ref(null)
const nicheZoneLayer = ref(null)

const draggedGridLayer = ref(null)
const previousDragCenter = ref(null)

function loadImageDimensions(imageSource) {
  return new Promise((resolve, reject) => {
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

function handleBlockSelected(blockId) {
  selectionStore.selectBlock(blockId)
}

function handleLotSelected(lotId, lotStatus) {
  selectionStore.selectLot(lotId, lotStatus)
}

function normalizeStatus(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function getLotStatus(feature) {
  const properties = feature?.properties ?? {}

  const saleStatus = normalizeStatus(properties.estatus_venta || properties.estatus)

  const occupationStatus = normalizeStatus(properties.estatus_ocupacion)

  if (occupationStatus === 'ocupado' || saleStatus === 'ocupado') {
    return 'ocupado'
  }

  if (saleStatus === 'separado') return 'separado'
  if (saleStatus === 'vendido') return 'vendido'
  if (saleStatus === 'disponible') return 'disponible'

  return 'sin-estado'
}

function filterLotsByStatus(featureCollection, filterId) {
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
      return getLotStatus(feature) === filterId
    }),
  }
}

function showBlocksForSection(sectionId) {
  if (!mapInstance.value || !blocks.value || !sectionId) return

  const filteredBlocks = filterBlockbySection(blocks.value, sectionId)

  closeLayerTooltips(sectionLayer.value)
  sectionLayer.value?.remove()
  lotLayer.value?.remove()
  closeLayerTooltips(nicheZoneLayer.value)
  nicheZoneLayer.value?.remove()
  closeLayerTooltips(blockLayer.value)
  blockLayer.value?.remove()

  blockLayer.value = createBlockLayer(
    filteredBlocks,
    'var(--color-block-outline)',
    selectionStore.selectedBlockId,
    handleBlockSelected,
  )

  blockLayer.value.addTo(mapInstance.value)
}

function showLotsForBlock(blockId) {
  if (!mapInstance.value || !lots.value || !selectionStore.selectedSectionId || !blockId) {
    console.warn('showLotsForBlock salió antes de cargar')
    return
  }

  const blockLots = filterLotsbyBlocks(lots.value, selectionStore.selectedSectionId, blockId)

  const filteredLots = filterLotsByStatus(blockLots, selectionStore.activeLotFilter)

  blockLayer.value?.remove()
  lotLayer.value?.remove()

  lotLayer.value = createLotLayer(filteredLots, selectionStore.selectedLotId, handleLotSelected)

  lotLayer.value.addTo(mapInstance.value)
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

    geometryType: 'lots',
    zone: selectionStore.selectedSectionId,
    side: null,
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

  if (geometryEditorStore.isEditing) {
    enableGridDragging()
  }

  console.log('Cuadricula GeoJSON:', featureCollection)
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

function closeLayerTooltips(layerGroup) {
  if (!layerGroup) return

  layerGroup.eachLayer((layer) => {
    layer.closeTooltip?.()
  })
}

onMounted(async () => {
  if (!mapContainer.value) return

  isLoading.value = true
  loadingError.value = ''

  try {
    geometryEditorStore.selectGeometryType('lots')

    mapInstance.value = Leaf.map(mapContainer.value, {
      crs: Leaf.CRS.Simple,
      minZoom: -3,
      maxZoom: 1,
      attributionControl: false,
    })

    gridLayers.value = Leaf.featureGroup().addTo(mapInstance.value)

    const { width, height } = await loadImageDimensions(mapImage)

    const imageBounds = [
      [0, 0],
      [height, width],
    ]

    Leaf.imageOverlay(mapImage, imageBounds).addTo(mapInstance.value)

    mapInstance.value.fitBounds(imageBounds)
    mapInstance.value.setMaxBounds(imageBounds)
    ;[sections.value, blocks.value, lots.value, nicheZones.value] = await Promise.all([
      GeometryService.getSections(),
      GeometryService.getBlocks(),
      GeometryService.getLots(),
      GeometryService.getNicheZones(),
    ])

    sectionLayer.value = createSectionLayer(
      sections.value,
      'var(--color-section-outline)',
      (sectionId) => {
        selectionStore.selectSection(sectionId)
        showBlocksForSection(sectionId)
      },
    )

    sectionLayer.value.addTo(mapInstance.value)

    nicheZoneLayer.value = createNicheZoneLayer(
      nicheZones.value,
      'var(--color-niche-zone-outline)',
      (nicheZone) => {
        selectionStore.clearSelection()
        nicheStore.selectZone(nicheZone)
      },
    )

    nicheZoneLayer.value.addTo(mapInstance.value)

    updateEditorTool()
  } catch (error) {
    console.error('No fue posible cargar el mapa:', error)

    loadingError.value = 'No fue posible cargar el mapa.'
  } finally {
    isLoading.value = false
  }
})

watch(() => [authStore.isAdminMode, geometryEditorStore.selectedTool], updateEditorTool)

watch(
  () => selectionStore.selectedSectionId,
  (newSectionId) => {
    if (!mapInstance.value) return

    if (newSectionId === null) {
      blockLayer.value?.remove()
      lotLayer.value?.remove()

      sectionLayer.value?.addTo(mapInstance.value)
      nicheZoneLayer.value?.addTo(mapInstance.value)
      nicheZoneLayer.value?.bringToFront()

      return
    }

    showBlocksForSection(newSectionId)
  },
)

watch(
  () => selectionStore.selectedBlockId,
  (newBlockId) => {
    if (!mapInstance.value) return

    lotLayer.value?.remove()

    if (newBlockId === null) {
      if (selectionStore.selectedSectionId) {
        showBlocksForSection(selectionStore.selectedSectionId)
      }

      return
    }

    showBlocksForSection(selectionStore.selectedSectionId)
  },
)

watch(
  () => selectionStore.areLotsVisible,
  (areLotsVisible) => {
    if (!mapInstance.value) return

    lotLayer.value?.remove()

    if (areLotsVisible && selectionStore.selectedSectionId && selectionStore.selectedBlockId) {
      showLotsForBlock(selectionStore.selectedBlockId)
      return
    }

    if (selectionStore.selectedSectionId) {
      showBlocksForSection(selectionStore.selectedSectionId)
    }
  },
)

watch(
  () => selectionStore.activeLotFilter,
  () => {
    if (!mapInstance.value || !selectionStore.areLotsVisible || !selectionStore.selectedBlockId) {
      return
    }

    showLotsForBlock(selectionStore.selectedBlockId)
  },
)

watch(
  () => selectionStore.selectedLotId,
  () => {
    if (!mapInstance.value || !selectionStore.areLotsVisible || !selectionStore.selectedBlockId) {
      return
    }

    showLotsForBlock(selectionStore.selectedBlockId)
  },
)

watch(
  () => gridEditorStore.generateRequest,
  () => {
    if (geometryEditorStore.geometryType === 'lots') {
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
  gridLayers.value = null
})
</script>

<template>
  <div class="map-wrapper">
    <div ref="mapContainer" class="leaflet-map"></div>

    <div v-if="isLoading" class="map-loading-overlay">
      <div class="map-loading-card">
        <span class="map-loading-spinner" aria-hidden="true"></span>
        <strong>Cargando mapa…</strong>
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
.map-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

.leaflet-map {
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
</style>
