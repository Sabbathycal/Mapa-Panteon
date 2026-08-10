import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { loadInventoryFromCsv } from '@/services/inventory/CsvInventorySource'

export const useInventoryStore = defineStore('inventory', () => {
  const records = ref([])

  const isLoading = ref(false)
  const error = ref(null)

  // Más adelante tendrá:
  // 'sharepoint' | 'csv' | 'geojson' | null
  const source = ref(null)

  const recordsByReferenceId = computed(() => {
    return new Map(records.value.map((record) => [record.referenceId, record]))
  })

  const lotRecords = computed(() => records.value.filter((record) => record.type === 'lote'))

  const nicheRecords = computed(() => records.value.filter((record) => record.type === 'nicho'))

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

  async function loadInventory() {
    if (isLoading.value) return

    isLoading.value = true
    error.value = null

    try {
      // Por ahora estamos desarrollando contra el respaldo CSV.
      // Después esta función intentará:
      //
      // SharePoint
      //   ↓ falla
      // CSV
      //   ↓ falla
      // GeoJSON

      const csvRecords = await loadInventoryFromCsv()

      records.value = csvRecords
      source.value = 'csv'

      console.info(`[Inventory] ${csvRecords.length} registros cargados desde CSV.`)
    } catch (loadError) {
      records.value = []
      source.value = null
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

  function clearInventory() {
    records.value = []
    source.value = null
    error.value = null
  }

  return {
    records,
    //--
    isLoading,
    error,
    source,
    //--
    recordsByReferenceId,
    lotRecords,
    nicheRecords,
    lotsByLocation,
    nichesByLocation,
    //-----------------------
    loadInventory,
    getByReferenceId,
    getLot,
    getLotFromGeometry,
    getNiche,
    getNicheFromGeometry,
    clearInventory,
  }
})
