function normalizeSearchValue(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
}

function normalizeLotNumber(value) {
  const normalizedValue = String(value ?? '').trim()

  if (!/^\d+$/.test(normalizedValue)) {
    return normalizedValue
  }

  return String(Number(normalizedValue))
}

function normalizeLotFeature(feature) {
  const properties = feature?.properties ?? {}

  const sectionId = String(properties?.seccion ?? properties?.sectionId ?? '').trim()

  const blockId = String(properties?.manzana ?? properties?.manzanaId ?? '').trim()

  const lotId = String(properties?.lote ?? properties?.id ?? '').trim()

  if (!sectionId || !blockId || !lotId) {
    return null
  }

  return {
    tipo: 'lote',

    codigo: `${sectionId}-${blockId}-${lotId}`,
    titulo: `${sectionId} - ${blockId} - ${lotId}`,

    seccionId: sectionId,
    manzanaId: blockId,
    loteId: lotId,

    estatus: properties.estatus ?? '',
    paquete: properties.paquete ?? '',

    feature,
  }
}

function createLotSearchText(lot) {
  const normalizedLotNumber = normalizeLotNumber(lot.loteId)

  return normalizeSearchValue(
    [
      lot.codigo,
      lot.titulo,

      lot.seccionId,
      lot.manzanaId,
      lot.loteId,
      normalizedLotNumber,

      lot.paquete,

      `${lot.seccionId} ${lot.manzanaId} ${lot.loteId}`,
      `${lot.seccionId} ${lot.manzanaId} ${normalizedLotNumber}`,

      `${lot.seccionId}-${lot.loteId}-${lot.manzanaId}`,
      `${lot.seccionId}-${normalizedLotNumber}-${lot.manzanaId}`,

      `${lot.loteId}-${lot.manzanaId}-${lot.seccionId}`,
      `${normalizedLotNumber}-${lot.manzanaId}-${lot.seccionId}`,
    ].join(' '),
  )
}

function calculateLotRelevance(lot, normalizedQuery) {
  const normalizedCode = normalizeSearchValue(lot.codigo)
  const normalizedTitle = normalizeSearchValue(lot.titulo)
  const normalizedSectionId = normalizeSearchValue(lot.seccionId)
  const normalizedBlockId = normalizeSearchValue(lot.manzanaId)
  const normalizedLotId = normalizeSearchValue(lot.loteId)
  const normalizedNumericLotId = normalizeSearchValue(normalizeLotNumber(lot.loteId))

  if (normalizedQuery === normalizedCode || normalizedQuery === normalizedTitle) {
    return 100
  }

  if (normalizedQuery === normalizedLotId) {
    return 90
  }

  if (normalizedQuery === normalizedNumericLotId) {
    return 89
  }

  if (normalizedQuery === normalizeSearchValue(`${lot.seccionId} ${lot.manzanaId} ${lot.loteId}`)) {
    return 85
  }

  if (normalizedQuery === normalizeSearchValue(`${lot.seccionId} ${lot.loteId} ${lot.manzanaId}`)) {
    return 80
  }

  if (normalizedQuery === normalizedSectionId) {
    return 70
  }

  if (normalizedQuery === normalizedBlockId) {
    return 60
  }

  if (normalizedCode.startsWith(normalizedQuery)) {
    return 50
  }

  return 10
}

function searchLots(lotFeatures, query, options = {}) {
  const normalizedQuery = normalizeSearchValue(query)
  const limit = options.limit ?? 50

  if (!normalizedQuery) {
    return []
  }

  const normalizedLots = lotFeatures.map(normalizeLotFeature).filter(Boolean)

  return normalizedLots
    .filter((lot) => {
      const searchText = createLotSearchText(lot)

      return searchText.includes(normalizedQuery)
    })
    .map((lot) => ({
      ...lot,
      relevance: calculateLotRelevance(lot, normalizedQuery),
    }))
    .sort((lotA, lotB) => {
      if (lotA.relevance !== lotB.relevance) {
        return lotB.relevance - lotA.relevance
      }

      const sectionComparison = lotA.seccionId.localeCompare(lotB.seccionId, 'es')

      if (sectionComparison !== 0) {
        return sectionComparison
      }

      const blockComparison = lotA.manzanaId.localeCompare(lotB.manzanaId, 'es')

      if (blockComparison !== 0) {
        return blockComparison
      }

      return lotA.loteId.localeCompare(lotB.loteId, 'es', {
        numeric: true,
      })
    })
    .slice(0, limit)
}

export const PropertySearchService = {
  normalizeSearchValue,
  searchLots,
}
