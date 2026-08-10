import Leaf from 'leaflet'
import { getGeometryColorByStatus } from '@/utils/geometryStatusColors'

export function createNicheLayer(niches, selectedNicheId, onNicheSelected, getFeatureStatus) {
  function getStatus(feature) {
    if (getFeatureStatus) {
      return getFeatureStatus(feature)
    }

    const properties = feature?.properties ?? {}

    return properties.estatus_ocupacion || properties.estatus_venta
  }

  function getNicheId(feature) {
    const properties = feature?.properties ?? {}

    return properties.id || properties.codigo
  }

  function isSelected(feature) {
    return String(getNicheId(feature)) === String(selectedNicheId)
  }

  function getDefaultStyle(feature) {
    const color = getGeometryColorByStatus(getStatus(feature))

    return {
      color: isSelected(feature) ? 'var(--color-selection)' : color,
      fillColor: color,
      weight: isSelected(feature) ? 4 : 1,
      fillOpacity: 0.65,
    }
  }

  return Leaf.geoJSON(niches, {
    style(feature) {
      return getDefaultStyle(feature)
    },

    onEachFeature(feature, layer) {
      layer.on({
        mouseover() {
          layer.setStyle({
            weight: isSelected(feature) ? 4 : 2,
            fillOpacity: 0.35,
          })

          layer.bringToFront()
        },

        mouseout() {
          layer.setStyle(getDefaultStyle(feature))
        },

        click() {
          onNicheSelected?.(feature.properties)
        },
      })
    },
  })
}
