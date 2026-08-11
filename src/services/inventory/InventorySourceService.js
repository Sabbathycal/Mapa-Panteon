import { loadInventoryFromSharePoint } from './SharepointInventorySource'
import { loadInventoryFromCsv } from './CsvInventorySource'

export async function loadInventoryFromBestAvailableSource() {
  try {
    return await loadInventoryFromSharePoint()
  } catch (error) {
    console.warn('[Inventory] SharePoint no disponible. Intentando CSV.', error)
  }

  try {
    return await loadInventoryFromCsv()
  } catch (error) {
    console.error('[Inventory] El respaldo CSV no está disponible.', error)

    return {
      records: [],
      source: 'geojson',
      lastUpdatedAt: null,
      sourceError: error,
    }
  }
}
