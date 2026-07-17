import Leaf from 'leaflet'
import { getLotColorByStatus } from '@/utils/lotStatusColors'

export function createLotLayer(lots, onLotsSelected) {
  return Leaf.geoJSON(lots, {
    style(feature) {
      console.log(feature.properties.estatus)

      const lotColor = getLotColorByStatus(feature.properties.estatus)

      return {
        color: lotColor,
        fillColor: lotColor,
        weight: 0.5,
        fill: true,
        fillOpacity: 0.5,
      }
    },

    onEachFeature(feature, layer) {
      const lotColor = getLotColorByStatus(feature.properties.estatus)

      layer.on({
        mouseover() {
          layer.setStyle({
            fillOpacity: 0.25,
          })
        },

        mouseout() {
          layer.setStyle({
            color: lotColor,
            fillColor: lotColor,
            weight: 0.5,
            fillOpacity: 0.5,
          })
        },

        click() {
          onLotsSelected(feature.properties.id, feature.properties.estatus)
        },
      })
    },
  })
}
