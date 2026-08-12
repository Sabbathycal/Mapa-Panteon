<script setup>
import { computed, ref, watch } from 'vue'

import { useInventoryStore } from '@/stores/Inventory.js'

const inventoryStore = useInventoryStore()

const isDetailsOpen = ref(false)
const isCsvWarningVisible = computed(() => {
  return source.value === 'csv' && !inventoryStore.csvWarningAcknowledged
})

const isGeoJsonWarningVisible = computed(() => {
  return source.value === 'geojson' && !inventoryStore.geoJsonWarningAcknowledged
})

const source = computed(() => inventoryStore.source)

const sourceLabel = computed(() => {
  switch (source.value) {
    case 'sharepoint':
      return 'Inventario en vivo'

    case 'csv':
      return 'Respaldo local'

    case 'geojson':
      return 'Datos cartográficos'

    default:
      return 'Fuente desconocida'
  }
})

const sourceDescription = computed(() => {
  switch (source.value) {
    case 'sharepoint':
      return 'Los datos están siendo consultados desde SharePoint.'

    case 'csv':
      return 'La fuente en vivo no está disponible. Se está utilizando una copia local del inventario.'

    case 'geojson':
      return 'No fue posible consultar el inventario en vivo ni el respaldo local.'

    default:
      return 'No fue posible determinar la fuente actual de los datos.'
  }
})

function toggleDetails() {
  isDetailsOpen.value = !isDetailsOpen.value
}

function closeDetails() {
  isDetailsOpen.value = false
}

function closeCsvWarning() {
  inventoryStore.acknowledgeCsvWarning()
}

function closeGeoJsonWarning() {
  inventoryStore.acknowledgeGeoJsonWarning()
}

watch(source, () => {
  isDetailsOpen.value = false
})
</script>

<template>
  <div v-if="source" class="inventory-status-control">
    <!-- Indicador permanente -->
    <button
      type="button"
      class="inventory-status-button"
      :class="`source-${source}`"
      :aria-label="sourceLabel"
      :title="sourceLabel"
      @click="toggleDetails"
    >
      <span v-if="source === 'sharepoint'" class="live-dot" />

      <span v-else class="warning-symbol"> ⚠ </span>
    </button>

    <!-- Información al tocar el indicador -->
    <div v-if="isDetailsOpen" class="inventory-details" :class="`source-${source}`">
      <button
        type="button"
        class="inventory-details-close"
        aria-label="Cerrar"
        @click="closeDetails"
      >
        ×
      </button>

      <strong>{{ sourceLabel }}</strong>

      <p>
        {{ sourceDescription }}
      </p>

      <p v-if="source === 'sharepoint' || source === 'csv'" class="inventory-update-date">
        <strong>Última actualización:</strong><br />
        {{ inventoryStore.lastUpdatedAt || 'Desconocida' }}
      </p>
    </div>

    <!-- CSV: advertencia moderada -->
    <div v-if="source === 'csv' && isCsvWarningVisible" class="csv-warning">
      <button
        type="button"
        class="warning-close"
        aria-label="Cerrar advertencia"
        @click="closeCsvWarning"
      >
        ×
      </button>

      <div class="warning-heading">
        <span>⚠</span>
        <strong>Usando respaldo local</strong>
      </div>

      <p>
        No fue posible consultar el inventario en vivo. Los datos pueden no reflejar cambios
        recientes.
      </p>

      <p class="inventory-update-date">
        <strong>Última actualización:</strong><br />
        {{ inventoryStore.lastUpdatedAt || 'Desconocida' }}
      </p>
    </div>

    <!-- GeoJSON: advertencia crítica -->
    <div v-if="source === 'geojson' && isGeoJsonWarningVisible" class="geojson-overlay">
      <div class="geojson-warning">
        <div class="geojson-warning-icon">⚠</div>

        <h2>INVENTARIO NO DISPONIBLE</h2>

        <p>No fue posible consultar el inventario en vivo ni el respaldo local.</p>

        <p>
          Los estados mostrados provienen únicamente de los archivos cartográficos y
          <strong>pueden ser incorrectos.</strong>
        </p>

        <p class="geojson-critical-message">
          NO UTILICE ESTA INFORMACIÓN PARA CONFIRMAR DISPONIBILIDAD, VENTA U OCUPACIÓN DE UNA
          PROPIEDAD.
        </p>

        <button type="button" class="geojson-continue-button" @click="closeGeoJsonWarning">
          Entiendo, continuar al mapa
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.inventory-status-control {
  position: absolute;
  inset: 0;
  z-index: 1000;
  pointer-events: none;
}

/* Indicador inferior izquierdo */

.inventory-status-button {
  position: absolute;
  left: 1rem;
  bottom: 1rem;

  width: 2.25rem;
  height: 2.25rem;

  display: flex;
  align-items: center;
  justify-content: center;

  padding: 0;

  border: 2px solid white;
  border-radius: 50%;

  background: white;

  font: inherit;

  cursor: pointer;
  pointer-events: auto;

  box-shadow: 0 2px 8px rgb(0 0 0 / 30%);
}

.inventory-status-button.source-sharepoint {
  background: #ffffff;
}

.inventory-status-button.source-csv {
  background: #f7c948;
  color: #392d00;
}

.inventory-status-button.source-geojson {
  background: #b42318;
  color: white;
}

.live-dot {
  width: 1rem;
  height: 1rem;

  border-radius: 50%;

  background: #22a447;

  box-shadow:
    0 0 0 2px rgb(34 164 71 / 20%),
    0 0 8px rgb(34 164 71 / 45%);
}

.warning-symbol {
  font-size: 1.25rem;
  line-height: 1;
}

/* Popover del indicador */

.inventory-details {
  position: absolute;
  left: 1rem;
  bottom: 3.8rem;

  width: min(19rem, calc(100% - 2rem));

  padding: 0.9rem;

  box-sizing: border-box;

  border-radius: 10px;

  background: white;
  color: #222;

  pointer-events: auto;

  box-shadow: 0 4px 16px rgb(0 0 0 / 25%);
}

.inventory-details p {
  margin: 0.5rem 0 0;

  font-size: 0.82rem;
  line-height: 1.4;
}

.inventory-details-close,
.warning-close {
  position: absolute;
  top: 0.35rem;
  right: 0.45rem;

  border: 0;
  background: transparent;

  font-size: 1.25rem;
  line-height: 1;

  cursor: pointer;
}

/* CSV */

.csv-warning {
  position: absolute;
  left: 1rem;
  bottom: 4rem;

  width: min(22rem, calc(100% - 2rem));

  padding: 1rem 2.2rem 1rem 1rem;

  box-sizing: border-box;

  border: 1px solid #d8a600;
  border-radius: 12px;

  background: #fff4c2;
  color: #392d00;

  pointer-events: auto;

  box-shadow: 0 4px 18px rgb(0 0 0 / 22%);
}

.warning-heading {
  display: flex;
  align-items: center;
  gap: 0.45rem;

  margin-bottom: 0.55rem;
}

.csv-warning p {
  margin: 0.35rem 0;

  font-size: 0.82rem;
  line-height: 1.4;
}

.inventory-update-date {
  margin-top: 0.65rem !important;
}

/* GeoJSON */

.geojson-overlay {
  position: absolute;
  inset: 0;

  display: flex;
  align-items: center;
  justify-content: center;

  padding: 1rem;

  box-sizing: border-box;

  background: rgb(0 0 0 / 58%);

  pointer-events: auto;
}

.geojson-warning {
  width: min(34rem, 100%);

  padding: 1.6rem;

  box-sizing: border-box;

  border: 3px solid #ffffff;
  border-radius: 14px;

  background: #a71919;
  color: white;

  text-align: center;

  box-shadow: 0 8px 30px rgb(0 0 0 / 45%);
}

.geojson-warning h2,
.geojson-warning strong {
  color: white;
}

.geojson-warning-icon {
  margin-bottom: 0.25rem;

  font-size: 2.5rem;
}

.geojson-warning h2 {
  margin: 0 0 1rem;

  font-size: 1.35rem;
}

.geojson-warning p {
  margin: 0.75rem 0;

  line-height: 1.5;
}

.geojson-critical-message {
  margin-top: 1.15rem !important;

  font-weight: 800;
}

.geojson-continue-button {
  margin-top: 1rem;
  padding: 0.7rem 1rem;

  border: 2px solid white;
  border-radius: 10px;

  background: white;
  color: #8b1111;

  font: inherit;
  font-weight: 800;

  cursor: pointer;
}
</style>
