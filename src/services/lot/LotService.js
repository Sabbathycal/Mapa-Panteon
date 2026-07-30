function createLotKey(sectionId, blockId, lotId) {
  return `${sectionId}-${blockId}-${lotId}`
}

const mockLots = {}

function normalizeLotsStatus(status) {
  const normalizedStatus = status?.trim().toLowerCase()

  if (normalizedStatus === 'ocupado') {
    return {
      estatus_venta: 'vendido',
      estatus_ocupacion: 'ocupado',
    }
  }

  return {
    estatus_venta: normalizedStatus ?? '',
    estatus_ocupacion: '',
  }
}

function getLotbyId(lotId, sectionId, blockId, lotStatus) {
  const lotKey = createLotKey(sectionId, blockId, lotId)

  const normalizedStatuses = normalizeLotsStatus(lotStatus)

  return (
    mockLots[lotKey] ?? {
      id: lotId,
      section: sectionId,
      block: blockId,

      estatus_venta: normalizedStatuses.estatus_venta,
      estatus_ocupacion: normalizedStatuses.estatus_ocupacion,

      referencia_procap: '',
      observaciones: '',
    }
  )
}

export const LotService = {
  getLotbyId,
}
