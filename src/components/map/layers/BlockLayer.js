import Leaf from 'leaflet'

export function createBlockLayer(blocks, blockColor, selectedBlockId, onBlockSelected) {
  function isSelected(feature) {
    return String(feature?.properties?.manzana) === String(selectedBlockId)
  }

  function getDefaultStyle(feature) {
    if (isSelected(feature)) {
      return {
        color: 'var(--color-selection)',
        weight: 4,
        fill: true,
        fillOpacity: 0.65,
      }
    }

    return {
      color: blockColor,
      weight: 1,
      fill: true,
      fillOpacity: 0.5,
    }
  }

  return Leaf.geoJSON(blocks, {
    style(feature) {
      return getDefaultStyle(feature)
    },

    pointToLayer(feature, latlng) {
      return Leaf.circle(latlng, {
        radius: feature.properties.radius,
        ...getDefaultStyle(feature),
      })
    },

    onEachFeature(feature, layer) {
      layer.bindTooltip(feature.properties.nombre, {
        permanent: false,
        direction: 'center',
        className: 'block-tooltip',
      })

      layer.on({
        mouseover() {
          layer.setStyle({
            weight: isSelected(feature) ? 4 : 2,
            fill: true,
            fillOpacity: 0.2,
          })

          layer.openTooltip()
        },

        mouseout() {
          layer.setStyle(getDefaultStyle(feature))
          layer.closeTooltip()
        },

        click() {
          layer.closeTooltip()
          onBlockSelected(feature.properties.manzana)
        },
      })
    },
  })
}
