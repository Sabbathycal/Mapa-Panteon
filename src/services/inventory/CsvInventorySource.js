import Papa from 'papaparse'

import { normalizeInventoryRow } from './InventoryNormalizer'

const CSV_URL = `${import.meta.env.BASE_URL}data/local/BI_Parque_Inventario.csv`

const REQUIRED_COLUMNS = ['Clave_Propiedad', 'Tipo_Propiedad', 'Seccion', 'Manzana', 'Codigo']

function validateColumns(fields = []) {
  const missingColumns = REQUIRED_COLUMNS.filter((column) => !fields.includes(column))

  if (missingColumns.length > 0) {
    throw new Error(`CSV de inventario inválido. Faltan columnas: ${missingColumns.join(', ')}`)
  }
}

function validateRecords(records) {
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error('El CSV de inventario no contiene registros válidos.')
  }

  // Protección para no aceptar accidentalmente un respaldo incompleto.
  if (records.length < 6000) {
    throw new Error(`El CSV parece incompleto: solo contiene ${records.length} registros.`)
  }
}

function parseSpanishDate(value) {
  const text = String(value ?? '').trim()

  if (!text) return null

  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s+([ap])\.\s*m\.$/i)

  if (!match) return null

  const [, day, month, year, rawHour, minute, period] = match

  let hour = Number(rawHour)

  if (period.toLowerCase() === 'p' && hour !== 12) {
    hour += 12
  }

  if (period.toLowerCase() === 'a' && hour === 12) {
    hour = 0
  }

  return new Date(Number(year), Number(month) - 1, Number(day), hour, Number(minute))
}

function getLatestInventoryUpdate(rows) {
  let latestDate = null
  let latestOriginalValue = null

  for (const row of rows) {
    const parsedDate = parseSpanishDate(row.Fecha_Actualizacion)

    if (parsedDate && (!latestDate || parsedDate > latestDate)) {
      latestDate = parsedDate
      latestOriginalValue = row.Fecha_Actualizacion
    }
  }

  return latestOriginalValue
}

export async function loadInventoryFromCsv() {
  const response = await fetch(CSV_URL, {
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`No fue posible cargar el CSV de inventario (${response.status}).`)
  }

  const inventoryCsv = await response.text()

  const parsed = Papa.parse(inventoryCsv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  })

  if (parsed.errors.length > 0) {
    const fatalErrors = parsed.errors.filter((error) => error.type !== 'FieldMismatch')

    if (fatalErrors.length > 0) {
      console.error('[Inventory] Errores al leer CSV:', fatalErrors)

      throw new Error('No fue posible interpretar el CSV de inventario.')
    }
  }

  validateColumns(parsed.meta.fields)

  const records = parsed.data
    .map((row) => normalizeInventoryRow(row))
    .filter((record) => record.referenceId)

  validateRecords(records)

  return {
    records,
    source: 'csv',
    lastUpdatedAt: getLatestInventoryUpdate(parsed.data),
  }
}
