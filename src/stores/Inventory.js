import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { loadInventoryFromBestAvailableSource } from '@/services/inventory/InventorySourceService'
import { loadInventoryFromSharePoint } from '@/services/inventory/SharePointInventorySource'

const INVENTORY_RECOVERY_INTERVAL = 5 * 60 * 1000

export const useInventoryStore = defineStore('inventory', () => {
  const records = ref([])

  const isLoading = ref(false)
  const error = ref(null)

  const csvWarningAcknowledged = ref(false)
  const geoJsonWarningAcknowledged = ref(false)

  const source = ref(null)
  const lastUpdatedAt = ref(null)
  const sourceError = ref(null)

  let inventoryRecoveryTimer = null
  let isRecoveringInventory = false

  const recordsByReferenceId = computed(() => {
    return new Map(records.value.map((record) => [record.referenceId, record]))
  })

  const lotRecords = computed(() => {
    return records.value.filter((record) => record.type === 'lote')
  })

  const nicheRecords = computed(() => {
    return records.value.filter((record) => record.type === 'nicho')
  })

  const lotsByLocation = computed(() => {
    const index = new Map()

    for (const record of lotRecords.value) {
      const key = [record.section, record.block, record.code].join('|')

      index.set(key, record)
    }

    return index
  })

  const nichesByLocation = computed(() => {
    const index = new Map()

    for (const record of nicheRecords.value) {
      const key = [record.zone, record.face, record.block, record.code].join('|')

      index.set(key, record)
    }

    return index
  })

  function stopInventoryRecovery() {
    if (inventoryRecoveryTimer) {
      clearTimeout(inventoryRecoveryTimer)
      inventoryRecoveryTimer = null
    }
  }

  function shouldRecoverInventory() {
    return source.value === 'csv' || source.value === 'geojson'
  }

  function scheduleInventoryRecovery() {
    stopInventoryRecovery()

    if (!shouldRecoverInventory()) {
      return
    }

    inventoryRecoveryTimer = setTimeout(() => {
      tryRecoverInventory()
    }, INVENTORY_RECOVERY_INTERVAL)
  }

  function applyInventoryResult(result) {
    records.value = result.records
    source.value = result.source
    lastUpdatedAt.value = result.lastUpdatedAt ?? null
    sourceError.value = result.sourceError ?? null
    error.value = null
  }

  async function recoverFromCsv() {
    console.info('[Inventory] Intentando restablecer conexión con SharePoint...')

    const result = await loadInventoryFromSharePoint()

    if (result.source !== 'sharepoint') {
      throw new Error('La recuperación respondió con una fuente distinta de SharePoint.')
    }

    applyInventoryResult(result)

    console.info(
      `[Inventory] Conexión con SharePoint restablecida. ${result.records.length} registros cargados.`,
    )
  }

  async function recoverFromGeoJson() {
    console.info('[Inventory] Intentando encontrar una fuente de inventario más confiable...')

    const result = await loadInventoryFromBestAvailableSource()

    if (result.source === 'geojson') {
      console.warn(
        '[Inventory] SharePoint y CSV continúan sin estar disponibles. Se mantiene GeoJSON.',
      )

      sourceError.value = result.sourceError ?? null

      return
    }

    applyInventoryResult(result)

    if (result.source === 'sharepoint') {
      console.info(
        `[Inventory] Inventario recuperado desde SharePoint. ${result.records.length} registros cargados.`,
      )

      return
    }

    if (result.source === 'csv') {
      csvWarningAcknowledged.value = false

      console.info(
        `[Inventory] Respaldo CSV recuperado. ${result.records.length} registros cargados.`,
      )

      console.info(`[Inventory] Última actualización: ${result.lastUpdatedAt ?? 'desconocida'}.`)
    }
  }

  async function tryRecoverInventory() {
    if (!shouldRecoverInventory()) {
      stopInventoryRecovery()
      return
    }

    if (isRecoveringInventory) {
      return
    }

    isRecoveringInventory = true

    const previousSource = source.value

    try {
      if (previousSource === 'csv') {
        await recoverFromCsv()
      } else if (previousSource === 'geojson') {
        await recoverFromGeoJson()
      }

      if (source.value === 'sharepoint') {
        stopInventoryRecovery()
      }
    } catch (recoveryError) {
      if (previousSource === 'csv') {
        console.warn(
          '[Inventory] SharePoint continúa sin estar disponible. Se mantiene el respaldo CSV.',
          recoveryError,
        )
      } else {
        console.warn(
          '[Inventory] No fue posible recuperar una fuente de inventario más confiable. Se mantiene GeoJSON.',
          recoveryError,
        )
      }
    } finally {
      isRecoveringInventory = false

      if (shouldRecoverInventory()) {
        scheduleInventoryRecovery()
      }
    }
  }

  async function loadInventory() {
    if (isLoading.value) return

    isLoading.value = true
    error.value = null

    stopInventoryRecovery()

    try {
      const result = await loadInventoryFromBestAvailableSource()

      applyInventoryResult(result)

      if (result.source === 'csv') {
        csvWarningAcknowledged.value = false
      }

      if (result.source === 'geojson') {
        geoJsonWarningAcknowledged.value = false
      }

      if (result.source === 'sharepoint') {
        console.info(`[Inventory] ${result.records.length} registros cargados desde SharePoint.`)
      }

      if (result.source === 'csv') {
        console.info(`[Inventory] ${result.records.length} registros cargados desde CSV.`)

        console.info(`[Inventory] Última actualización: ${result.lastUpdatedAt ?? 'desconocida'}.`)

        scheduleInventoryRecovery()
      }

      if (result.source === 'geojson') {
        console.warn(
          '[Inventory] Usando GeoJSON como último respaldo. Los datos administrativos pueden no ser confiables.',
        )

        scheduleInventoryRecovery()
      }
    } catch (loadError) {
      records.value = []
      source.value = null
      lastUpdatedAt.value = null
      sourceError.value = null

      error.value = loadError

      console.error('[Inventory] No fue posible cargar el inventario:', loadError)

      throw loadError
    } finally {
      isLoading.value = false
    }
  }

  function getByReferenceId(referenceId) {
    if (!referenceId) return null

    return recordsByReferenceId.value.get(referenceId) ?? null
  }

  function normalizeLookupCode(value) {
    const text = String(value ?? '').trim()

    if (!text) return ''

    return /^\d+$/.test(text) ? text.padStart(3, '0') : text.toUpperCase()
  }

  function getLot(section, block, code) {
    const normalizedSection = String(section ?? '')
      .trim()
      .toUpperCase()

    const normalizedBlock = String(block ?? '')
      .trim()
      .toUpperCase()

    const normalizedCode = normalizeLookupCode(code)

    const key = [normalizedSection, normalizedBlock, normalizedCode].join('|')

    return lotsByLocation.value.get(key) ?? null
  }

  function getNiche(zone, face, block, code) {
    const key = [
      String(zone ?? '')
        .trim()
        .toUpperCase(),

      String(face ?? '')
        .trim()
        .toLowerCase(),

      String(block ?? '')
        .trim()
        .toUpperCase(),

      String(code ?? '').trim(),
    ].join('|')

    return nichesByLocation.value.get(key) ?? null
  }

  function getNicheFromGeometry(properties) {
    if (!properties) return null

    const zone = String(properties.zonaId ?? '')
      .trim()
      .toUpperCase()

    const face = String(properties.cara ?? '')
      .trim()
      .toLowerCase()

    const row = String(properties.fila ?? '')
      .trim()
      .toUpperCase()

    const number = String(properties.numero ?? '').trim()

    if (!zone || !face || !row || !number) {
      return null
    }

    let block = row

    if (zone === 'PLN' && face === 'concavo') {
      block = `${row}${number.charAt(0)}`
    }

    return getNiche(zone, face, block, number)
  }

  function getLotFromGeometry(properties) {
    if (!properties) return null

    const section = String(properties.seccion ?? '')
      .trim()
      .toUpperCase()

    const block = String(properties.manzana ?? properties.manzanaId ?? '')
      .trim()
      .toUpperCase()

    const code = String(properties.lote ?? properties.id ?? '').trim()

    if (!section || !block || !code) {
      return null
    }

    return getLot(section, block, code)
  }

  function acknowledgeCsvWarning() {
    csvWarningAcknowledged.value = true
  }

  function acknowledgeGeoJsonWarning() {
    geoJsonWarningAcknowledged.value = true
  }

  function clearInventory() {
    stopInventoryRecovery()

    records.value = []
    source.value = null
    error.value = null
    lastUpdatedAt.value = null
    sourceError.value = null

    isRecoveringInventory = false
  }

  return {
    records,
    //--
    isLoading,
    error,
    source,
    lastUpdatedAt,
    sourceError,
    //--
    recordsByReferenceId,
    lotRecords,
    nicheRecords,
    lotsByLocation,
    nichesByLocation,
    //--
    csvWarningAcknowledged,
    geoJsonWarningAcknowledged,
    //------------------------------
    loadInventory,
    getByReferenceId,
    getLot,
    getLotFromGeometry,
    getNiche,
    getNicheFromGeometry,
    acknowledgeCsvWarning,
    acknowledgeGeoJsonWarning,
    clearInventory,
  }
})
