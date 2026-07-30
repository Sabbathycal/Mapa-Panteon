import Leaf from 'leaflet'
import { getGeometryColorByStatus } from '@/utils/geometryStatusColors'

export function createNicheLayer(niches, onNicheSelected) {
  return Leaf.geoJSON(niches, {
    style(feature) {
      const properties = feature?.properties ?? {}

      const status = properties.estatus_ocupacion || properties.estatus_venta

      const color = getGeometryColorByStatus(status)

      return {
        color,
        fillColor: color,
        weight: 1,
        fillOpacity: 0.65,
      }
    },

    onEachFeature(feature, layer) {
      layer.on({
        mouseover() {
          layer.setStyle({
            weight: 2,
            fillOpacity: 0.35,
          })

          layer.bringToFront()
        },

        mouseout() {
          const properties = feature?.properties ?? {}

          const status = properties.estatus_ocupacion || properties.estatus_venta

          const color = getGeometryColorByStatus(status)

          layer.setStyle({
            color,
            fillColor: color,
            weight: 1,
            fillOpacity: 0.65,
          })
        },

        click() {
          onNicheSelected?.(feature.properties)
        },
      })
    },
  })
}
