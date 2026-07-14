import Leaf from 'leaflet'

export function createLotLayer(lots, lotColor) {
    return Leaf.geoJSON(lots, {
        style: {
            color: lotColor,
            weight: 0.5,
            fill: false,
        },
    })
}