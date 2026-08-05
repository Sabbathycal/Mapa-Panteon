import Leaf from 'leaflet'

export function createBlockLayer(blocks, blockColor, onBlockSelected) {
  return Leaf.geoJSON(blocks, {
    style: {
      color: blockColor,
      weight: 1,
      fill: true,
      fillOpacity: 0.5,
    },

    pointToLayer(feature, latlng) {
      return Leaf.circle(latlng, {
        radius: feature.properties.radius,
        color: blockColor,
        weight: 1,
        fill: true,
        fillOpacity: 0.5,
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
            weight: 2,
            fill: true,
            fillOpacity: 0.2,
          })

          layer.openTooltip()
        },

        mouseout() {
          layer.setStyle({
            color: blockColor,
            weight: 1,
            fill: true,
            fillOpacity: 0.5,
          })

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
