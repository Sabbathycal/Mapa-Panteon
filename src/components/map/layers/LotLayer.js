import Leaf from 'leaflet'

export function createLotLayer(lots, lotColor, onLotsSelected) {
    return Leaf.geoJSON(lots, {
        style: {
            color: lotColor,
            weight: 0.5,
            fill: true,
            fillOpacity: 0.5
        },

        onEachFeature(feature, layer) {
            layer.on('click', () => {
                onLotsSelected(feature.properties.id)
            }
        )
        }

    })
}