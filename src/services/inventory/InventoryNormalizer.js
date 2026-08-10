const SECTION_ALIASES = {
  SJV: 'SAN JUAN VIP',
  SMV: 'SAN MATEO VIP',
  SPV: 'SAN PEDRO VIP',
}

function normalizeText(value) {
  return String(value ?? '').trim()
}

function normalizeUpper(value) {
  return normalizeText(value).toUpperCase()
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase()
}

function normalizeBoolean(value) {
  const normalized = normalizeUpper(value)

  if (['TRUE', 'VERDADERO', 'SI', 'SÍ', '1'].includes(normalized)) {
    return true
  }

  if (['FALSE', 'FALSO', 'NO', '0'].includes(normalized)) {
    return false
  }

  return null
}

function normalizeNumber(value) {
  const text = normalizeText(value)

  if (!text) return null

  const number = Number(text)

  return Number.isFinite(number) ? number : null
}

function normalizeCode(value, length = 3) {
  const text = normalizeText(value)

  if (!text) return ''

  return /^\d+$/.test(text) ? text.padStart(length, '0') : normalizeUpper(text)
}

function normalizeSection(value) {
  const section = normalizeUpper(value)

  return SECTION_ALIASES[section] ?? section
}

function normalizeType(row) {
  const type = normalizeUpper(row.Tipo_Propiedad)

  if (type.includes('NICHO')) {
    return 'nicho'
  }

  return 'lote'
}

function normalizeSaleStatus(value) {
  const status = normalizeUpper(value)

  if (!status) return null

  if (status.includes('DISPONIBLE') || status.includes('LIBRE')) {
    return 'disponible'
  }

  if (
    status.includes('APARTADO') ||
    status.includes('APARTADA') ||
    status.includes('SEPARADO') ||
    status.includes('SEPARADA')
  ) {
    return 'separado'
  }

  if (status.includes('VENDIDO') || status.includes('VENDIDA')) {
    return 'vendido'
  }

  return normalizeLower(status)
}

function normalizeUsageStatus(value) {
  const status = normalizeUpper(value)

  if (!status) return null

  if (
    status.includes('OCUPADO') ||
    status.includes('OCUPADA') ||
    status.includes('USADO') ||
    status.includes('USADA') ||
    status.includes('UTILIZADO') ||
    status.includes('UTILIZADA')
  ) {
    return 'ocupado'
  }

  if (status.includes('DISPONIBLE') || status.includes('LIBRE')) {
    return 'disponible'
  }

  return normalizeLower(status)
}

function normalizeSearchAliases(value) {
  const text = normalizeText(value)

  if (!text) return []

  return text
    .split(/[;,|]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function resolveStatus(row) {
  const burialUses = normalizeNumber(row.Uso_Inhumacion)
  const ashUses = normalizeNumber(row.Usos_Cenizas)

  if ((burialUses ?? 0) > 0 || (ashUses ?? 0) > 0) {
    return 'ocupado'
  }

  const occupancyStatus = normalizeUsageStatus(row.Estatus_Ocupacion)

  if (occupancyStatus === 'ocupado') {
    return 'ocupado'
  }

  const usageStatus = normalizeUsageStatus(row.Estatus_Uso)

  if (usageStatus === 'ocupado') {
    return 'ocupado'
  }

  return normalizeSaleStatus(row.Estatus_Venta) ?? 'sin_estatus'
}

function normalizeCommonFields(row) {
  return {
    referenceId: normalizeText(row.Clave_Propiedad),

    status: resolveStatus(row),

    saleStatus: normalizeSaleStatus(row.Estatus_Venta),
    usageStatus: normalizeUsageStatus(row.Estatus_Uso),
    occupancyStatus: normalizeUsageStatus(row.Estatus_Ocupacion),

    isBuilt: normalizeBoolean(row.Esta_Construido) ?? normalizeBoolean(row.Esta_Construida),

    procapReference: normalizeText(row.Referencia_ProcaP),
    deceased: normalizeText(row.Finado),
    observations: normalizeText(row.Observaciones),

    capacityBurials: normalizeNumber(row.Capacidad_Inhumaciones),

    burialUses: normalizeNumber(row.Uso_Inhumacion),

    capacityAshes: normalizeNumber(row.Capacidad_Cenizas),

    ashUses: normalizeNumber(row.Usos_Cenizas),

    capacityStatus: normalizeText(row.Estatus_Capacidad),

    primarySearchKey: normalizeText(row.Clave_Busqueda_Principal),

    alternativeSearchKeys: normalizeSearchAliases(row.Claves_Busqueda_Alternas),
  }
}

function normalizeLot(row) {
  const section = normalizeSection(row.Seccion)
  const block = normalizeUpper(row.Manzana)
  const code = normalizeCode(row.Codigo)

  const common = normalizeCommonFields(row)

  return {
    ...common,

    type: 'lote',

    section,
    block,
    code,

    referenceId: common.referenceId || `${section}-${block}-${code}`,
  }
}

function normalizeNiche(row) {
  const zone = normalizeUpper(row.ZonaId || row.Seccion)

  const face = normalizeLower(row.Cara)
  const block = normalizeUpper(row.Manzana)
  const code = normalizeText(row.Codigo)

  const common = normalizeCommonFields(row)

  return {
    ...common,

    type: 'nicho',

    zone,
    face,
    block,
    code,

    referenceId: common.referenceId || `${zone}-${face}-${block}-${code}`,
  }
}

export function normalizeInventoryRow(row) {
  const type = normalizeType(row)

  if (type === 'nicho') {
    return normalizeNiche(row)
  }

  return normalizeLot(row)
}
