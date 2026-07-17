import Leaf from 'leaflet'

export function createLotLayer(lots, lotColor, onLotsSelected) {
  return Leaf.geoJSON(lots, {
    style: {
      color: lotColor,
      weight: 0.5,
      fill: true,
      fillOpacity: 0.5,
    },

    onEachFeature(feature, layer) {
      layer.on({
        mouseover() {
          layer.setStyle({
            weight: 1,
            fillOpacity: 0.25,
          })
        },

        mouseout() {
          layer.setStyle({
            color: lotColor,
            weight: 0.5,
            fill: true,
            fillOpacity: 0.5,
          })
        },

        click() {
          onLotsSelected(feature.properties.id)
        },
      })
    },
  })
}
