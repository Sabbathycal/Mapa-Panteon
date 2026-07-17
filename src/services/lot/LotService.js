function createLotKey(sectionId, blockId, lotId) {
  return `${sectionId}-${blockId}-${lotId}`
}

const mockLots = {}

function getLotbyId(lotId, sectionId, blockId, lotStatus) {
  const lotKey = createLotKey(sectionId, blockId, lotId)

  return (
    mockLots[lotKey] ?? {
      id: lotId,
      section: sectionId,
      block: blockId,
      owner: '',
      status: lotStatus ?? '',
      package: '',
      observations: '',
    }
  )
}

export const LotService = {
  getLotbyId,
}
