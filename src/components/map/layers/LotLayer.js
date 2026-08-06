import Leaf from 'leaflet'
import { getGeometryColorByStatus } from '@/utils/geometryStatusColors'

export function createLotLayer(lots, selectedLotId, onLotsSelected) {
  function getStatus(feature) {
    return (
      feature?.properties?.estatus_ocupacion ||
      feature?.properties?.estatus_venta ||
      feature?.properties?.estatus
    )
  }

  function isSelected(feature) {
    return String(feature?.properties?.id) === String(selectedLotId)
  }

  function getDefaultStyle(feature) {
    const lotColor = getGeometryColorByStatus(getStatus(feature))

    return {
      color: isSelected(feature) ? 'var(--color-selection)' : lotColor,
      fillColor: lotColor,
      weight: isSelected(feature) ? 4 : 0.5,
      fill: true,
      fillOpacity: 0.5,
    }
  }

  return Leaf.geoJSON(lots, {
    style(feature) {
      return getDefaultStyle(feature)
    },

    onEachFeature(feature, layer) {
      const status = getStatus(feature)

      layer.on({
        mouseover() {
          layer.setStyle({
            weight: isSelected(feature) ? 4 : 1.5,
            fillOpacity: 0.25,
          })

          layer.bringToFront()
        },

        mouseout() {
          layer.setStyle(getDefaultStyle(feature))
        },

        click() {
          onLotsSelected(feature.properties.id, status)
        },
      })
    },
  })
}
