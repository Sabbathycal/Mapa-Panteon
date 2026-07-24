let temporaryId = 1

export function createNicheGeometry(feature, zoneId, side) {
  return {
    id: `TEMP-${String(temporaryId++).padStart(3, '0')}`,

    zona: zoneId,
    lado: side,

    fila: '',
    numero: '',

    estado: 'disponible',

    geojson: feature,
  }
}
