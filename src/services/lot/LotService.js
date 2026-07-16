function createLotKey(sectionId, blockId, lotId) {
  return `${sectionId}-${blockId}-${lotId}`
}

const mockLots = {
  'BRONCE-A-050': {
    id: '050',

    section: 'BRONCE',
    block: 'A',

    owner: 'Sin Asignar',

    status: 'Disponible',

    package: 'Bronce',

    observations: '',
  },
}

function getLotbyId(lotId, sectionId, blockId) {
  const lotKey = createLotKey(sectionId, blockId, lotId)

  return (
    mockLots[lotKey] ?? {
      id: lotId,
      section: sectionId,
      block: blockId,
      owner: '',
      status: '',
      package: '',
      observations: '',
    }
  )
}

export const LotService = {
  getLotbyId,
}
