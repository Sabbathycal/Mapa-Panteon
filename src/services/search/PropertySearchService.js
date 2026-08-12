const SECTION_ALIASES = {
  SJV: 'SAN JUAN VIP',
  SMV: 'SAN MATEO VIP',
  SPV: 'SAN PEDRO VIP',
}

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

function normalizeNicheNumber(value) {
  const normalizedValue = String(value ?? '').trim()

  if (!/^\d+$/.test(normalizedValue)) {
    return normalizedValue
  }

  return String(Number(normalizedValue))
}

function normalizeSectionForLookup(value) {
  const section = String(value ?? '')
    .trim()
    .toUpperCase()

  return SECTION_ALIASES[section] ?? section
}

function createLotInventoryKey(section, block, code) {
  return [
    normalizeSectionForLookup(section),
    String(block ?? '')
      .trim()
      .toUpperCase(),
    normalizeLotNumber(code),
  ].join('|')
}

function createNicheInventoryKey(zone, face, block, code) {
  return [
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
}

let cachedInventoryRecords = null
let cachedInventoryIndexes = null

function getInventoryIndexes(records = []) {
  if (cachedInventoryRecords === records && cachedInventoryIndexes) {
    return cachedInventoryIndexes
  }

  const lots = new Map()
  const niches = new Map()

  for (const record of records) {
    if (record?.type === 'lote') {
      const key = createLotInventoryKey(record.section, record.block, record.code)

      lots.set(key, record)
      continue
    }

    if (record?.type === 'nicho') {
      const key = createNicheInventoryKey(record.zone, record.face, record.block, record.code)

      niches.set(key, record)
    }
  }

  cachedInventoryRecords = records
  cachedInventoryIndexes = {
    lots,
    niches,
  }

  return cachedInventoryIndexes
}

function getLotInventoryRecord(feature, inventoryIndexes) {
  const properties = feature?.properties ?? {}

  const section = properties.seccion ?? properties.sectionId ?? ''

  const block = properties.manzana ?? properties.manzanaId ?? ''

  const lot = properties.lote ?? properties.id ?? ''

  const key = createLotInventoryKey(section, block, lot)

  return inventoryIndexes.lots.get(key) ?? null
}

function getNicheInventoryRecord(feature, inventoryIndexes) {
  const properties = feature?.properties ?? {}

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

  // PLN cóncavo usa fila + primer dígito del número
  // para relacionarse con el inventario.
  if (zone === 'PLN' && face === 'concavo') {
    block = `${row}${number.charAt(0)}`
  }

  const key = createNicheInventoryKey(zone, face, block, number)

  return inventoryIndexes.niches.get(key) ?? null
}

function normalizeLotFeature(feature, inventoryIndexes) {
  const properties = feature?.properties ?? {}

  const sectionId = String(properties.seccion ?? properties.sectionId ?? '').trim()

  const blockId = String(properties.manzana ?? properties.manzanaId ?? '').trim()

  const lotId = String(properties.lote ?? properties.id ?? '').trim()

  if (!sectionId || !blockId || !lotId) {
    return null
  }

  const inventoryRecord = getLotInventoryRecord(feature, inventoryIndexes)

  return {
    tipo: 'lote',

    codigo: `${sectionId}-${blockId}-${lotId}`,
    titulo: `${sectionId} - ${blockId} - ${lotId}`,

    seccionId: sectionId,
    manzanaId: blockId,
    loteId: lotId,

    estatus:
      inventoryRecord?.status ??
      properties.estatus_ocupacion ??
      properties.estatus_venta ??
      properties.estatus ??
      '',

    paquete: properties.paquete ?? '',

    referenceId: inventoryRecord?.referenceId ?? '',

    procapReference: inventoryRecord?.procapReference ?? '',

    primarySearchKey: inventoryRecord?.primarySearchKey ?? '',

    alternativeSearchKeys: inventoryRecord?.alternativeSearchKeys ?? [],

    inventoryRecord,
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

      lot.referenceId,
      lot.procapReference,
      lot.primarySearchKey,
      ...(lot.alternativeSearchKeys ?? []),

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

  const normalizedReferenceId = normalizeSearchValue(lot.referenceId)

  const normalizedProcapReference = normalizeSearchValue(lot.procapReference)

  const normalizedPrimarySearchKey = normalizeSearchValue(lot.primarySearchKey)

  const normalizedAlternativeKeys = (lot.alternativeSearchKeys ?? []).map(normalizeSearchValue)

  if (normalizedQuery === normalizedProcapReference && normalizedProcapReference) {
    return 130
  }

  if (normalizedQuery === normalizedReferenceId && normalizedReferenceId) {
    return 125
  }

  if (normalizedQuery === normalizedPrimarySearchKey && normalizedPrimarySearchKey) {
    return 120
  }

  if (normalizedAlternativeKeys.includes(normalizedQuery)) {
    return 115
  }

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

function normalizeNicheFeature(feature, inventoryIndexes) {
  const properties = feature?.properties ?? {}

  const zoneId = String(properties.zonaId ?? '').trim()

  const side = String(properties.cara ?? '').trim()

  const row = String(properties.fila ?? '').trim()

  const number = String(properties.numero ?? '').trim()

  const code = String(properties.codigo ?? `${row}${number}`).trim()

  if (!zoneId || !side || !row || !number) {
    return null
  }

  const sideLabel = side === 'concavo' ? 'Cóncavo' : 'Convexo'

  const inventoryRecord = getNicheInventoryRecord(feature, inventoryIndexes)

  return {
    tipo: 'nicho',

    codigo: `${zoneId}-${side}-${code}`,
    titulo: `${zoneId} - ${sideLabel} - ${code}`,

    zonaId: zoneId,
    cara: side,
    fila: row,
    numero: number,
    nichoCodigo: code,

    estatus:
      inventoryRecord?.status ?? properties.estatus_ocupacion ?? properties.estatus_venta ?? '',

    referenceId: inventoryRecord?.referenceId ?? '',

    procapReference: inventoryRecord?.procapReference ?? '',

    primarySearchKey: inventoryRecord?.primarySearchKey ?? '',

    alternativeSearchKeys: inventoryRecord?.alternativeSearchKeys ?? [],

    inventoryRecord,
    feature,
  }
}

function createNicheSearchText(niche) {
  const normalizedNumber = normalizeNicheNumber(niche.numero)

  return normalizeSearchValue(
    [
      niche.codigo,
      niche.titulo,

      niche.zonaId,
      niche.cara,
      niche.fila,
      niche.numero,
      normalizedNumber,
      niche.nichoCodigo,

      niche.referenceId,
      niche.procapReference,
      niche.primarySearchKey,
      ...(niche.alternativeSearchKeys ?? []),

      `${niche.zonaId} ${niche.cara} ${niche.nichoCodigo}`,
      `${niche.zonaId} ${niche.fila} ${niche.numero}`,
      `${niche.zonaId} ${niche.fila} ${normalizedNumber}`,

      `${niche.fila}${niche.numero}`,
      `${niche.fila}${normalizedNumber}`,
    ].join(' '),
  )
}

function calculateNicheRelevance(niche, normalizedQuery) {
  const normalizedCode = normalizeSearchValue(niche.codigo)

  const normalizedTitle = normalizeSearchValue(niche.titulo)

  const normalizedNicheCode = normalizeSearchValue(niche.nichoCodigo)

  const normalizedNumber = normalizeSearchValue(niche.numero)

  const normalizedNumericNumber = normalizeSearchValue(normalizeNicheNumber(niche.numero))

  const normalizedZone = normalizeSearchValue(niche.zonaId)

  const normalizedReferenceId = normalizeSearchValue(niche.referenceId)

  const normalizedProcapReference = normalizeSearchValue(niche.procapReference)

  const normalizedPrimarySearchKey = normalizeSearchValue(niche.primarySearchKey)

  const normalizedAlternativeKeys = (niche.alternativeSearchKeys ?? []).map(normalizeSearchValue)

  if (normalizedQuery === normalizedProcapReference && normalizedProcapReference) {
    return 130
  }

  if (normalizedQuery === normalizedReferenceId && normalizedReferenceId) {
    return 125
  }

  if (normalizedQuery === normalizedPrimarySearchKey && normalizedPrimarySearchKey) {
    return 120
  }

  if (normalizedAlternativeKeys.includes(normalizedQuery)) {
    return 115
  }

  if (normalizedQuery === normalizedCode || normalizedQuery === normalizedTitle) {
    return 100
  }

  if (normalizedQuery === normalizedNicheCode) {
    return 95
  }

  if (normalizedQuery === normalizedNumber) {
    return 90
  }

  if (normalizedQuery === normalizedNumericNumber) {
    return 89
  }

  if (normalizedQuery === normalizedZone) {
    return 70
  }

  if (normalizedCode.startsWith(normalizedQuery)) {
    return 50
  }

  return 10
}

function searchNiches(nicheFeatures, query, options = {}) {
  const normalizedQuery = normalizeSearchValue(query)

  const limit = options.limit ?? 50

  if (!normalizedQuery) {
    return []
  }

  const inventoryIndexes = getInventoryIndexes(options.inventoryRecords ?? [])

  const normalizedNiches = nicheFeatures
    .map((feature) => normalizeNicheFeature(feature, inventoryIndexes))
    .filter(Boolean)

  return normalizedNiches
    .filter((niche) => createNicheSearchText(niche).includes(normalizedQuery))
    .map((niche) => ({
      ...niche,
      relevance: calculateNicheRelevance(niche, normalizedQuery),
    }))
    .sort((nicheA, nicheB) => {
      if (nicheA.relevance !== nicheB.relevance) {
        return nicheB.relevance - nicheA.relevance
      }

      const zoneComparison = nicheA.zonaId.localeCompare(nicheB.zonaId, 'es')

      if (zoneComparison !== 0) {
        return zoneComparison
      }

      const sideComparison = nicheA.cara.localeCompare(nicheB.cara, 'es')

      if (sideComparison !== 0) {
        return sideComparison
      }

      const rowComparison = nicheA.fila.localeCompare(nicheB.fila, 'es')

      if (rowComparison !== 0) {
        return rowComparison
      }

      return String(nicheA.numero).localeCompare(String(nicheB.numero), 'es', {
        numeric: true,
      })
    })
    .slice(0, limit)
}

function searchLots(lotFeatures, query, options = {}) {
  const normalizedQuery = normalizeSearchValue(query)

  const limit = options.limit ?? 50

  if (!normalizedQuery) {
    return []
  }

  const inventoryIndexes = getInventoryIndexes(options.inventoryRecords ?? [])

  const normalizedLots = lotFeatures
    .map((feature) => normalizeLotFeature(feature, inventoryIndexes))
    .filter(Boolean)

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

function searchProperties(lotFeatures, nicheFeatures, query, options = {}) {
  const limit = options.limit ?? 50

  const lotResults = searchLots(lotFeatures, query, options)

  const nicheResults = searchNiches(nicheFeatures, query, options)

  return [...lotResults, ...nicheResults]
    .sort((resultA, resultB) => {
      if (resultA.relevance !== resultB.relevance) {
        return resultB.relevance - resultA.relevance
      }

      return resultA.titulo.localeCompare(resultB.titulo, 'es', {
        numeric: true,
      })
    })
    .slice(0, limit)
}

export const PropertySearchService = {
  normalizeSearchValue,
  searchLots,
  searchNiches,
  searchProperties,
}
