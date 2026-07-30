import Leaf from 'leaflet'
import { getGeometryColorByStatus } from '@/utils/geometryStatusColors'

export function createLotLayer(lots, onLotsSelected) {
  return Leaf.geoJSON(lots, {
    style(feature) {
      console.log(feature.properties.estatus)

      const status =
        feature.properties.estatus_ocupacion ||
        feature.properties.estatus_venta ||
        feature.properties.estatus

      const lotColor = getGeometryColorByStatus(status)

      return {
        color: lotColor,
        fillColor: lotColor,
        weight: 0.5,
        fill: true,
        fillOpacity: 0.5,
      }
    },

    onEachFeature(feature, layer) {
      const status =
        feature.properties.estatus_ocupacion ||
        feature.properties.estatus_venta ||
        feature.properties.estatus

      const lotColor = getGeometryColorByStatus(status)

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
          onLotsSelected(feature.properties.id, status)
        },
      })
    },
  })
}
