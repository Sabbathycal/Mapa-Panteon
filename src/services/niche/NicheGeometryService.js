export function createNicheGeometry(feature, { zoneId, side, row = '', number = '' }) {
  const normalizedRow = String(row).trim().toUpperCase()

  const hasNumbering =
    normalizedRow !== '' && number !== '' && number !== null && number !== undefined

  const normalizedNumber = hasNumbering ? Number(number) : ''

  const code = hasNumbering ? `${normalizedRow}${normalizedNumber}` : ''

  const id = hasNumbering ? `${zoneId}-${side}-${code}` : crypto.randomUUID()

  return {
    id,

    tipo: 'nicho',

    zonaId: zoneId,
    cara: side,

    fila: normalizedRow,
    numero: normalizedNumber,
    codigo: code,

    estatus_venta: 'disponible',
    estatus_ocupacion: '',

    referencia_procap: '',
    observaciones: '',

    geojson: feature,
  }
}
