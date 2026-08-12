import { loadInventoryFromSharePoint } from './SharePointInventorySource'
import { loadInventoryFromCsv } from './CsvInventorySource'

export async function loadInventoryFromBestAvailableSource() {
  try {
    if (localStorage.getItem('simulateSharePointFailure') === '1') {
      throw new Error('Fallo simulado de SharePoint.')
    }

    return await loadInventoryFromSharePoint()
  } catch (error) {
    console.warn('[Inventory] SharePoint no disponible. Intentando CSV.', error)
  }

  try {
    if (localStorage.getItem('simulateCsvFailure') === '1') {
      throw new Error('Fallo simulado del respaldo CSV.')
    }

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
