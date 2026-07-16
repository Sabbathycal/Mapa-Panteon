const mockLots = {
    '050' : {
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
    return mockLots[lotId] ?? {
    id: lotId,
    section: sectionId,
    block: blockId,
    owner: '',
    status: '',
    package: '',
    observations: '',
    }
}

export const LotService = {
    getLotbyId,
    }