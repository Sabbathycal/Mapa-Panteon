import Leaf from 'leaflet'

export function createNicheZoneLayer(nicheZones, zoneColor, onNicheZoneSelected) {
  return Leaf.geoJSON(nicheZones, {
    style: {
      color: 'transparent',
      opacity: 0,
      weight: 3,
      fill: true,
      fillOpacity: 0.001,
    },

    onEachFeature(feature, layer) {
      const originalStyle = {
        color: 'transparent',
        opacity: 0,
        weight: 3,
        fill: true,
        fillOpacity: 0.001,
      }

      layer.on({
        mouseover() {
          layer.setStyle({
            color: zoneColor,
            opacity: 1,
            weight: 4,
            fillOpacity: 0.25,
          })

          layer
            .bindTooltip(feature.properties.nombre, {
              direction: 'center',
              className: 'niche-zone-tooltip',
            })
            .openTooltip()
        },

        mouseout() {
          layer.setStyle(originalStyle)
          layer.closeTooltip()
        },

        click() {
          layer.setStyle(originalStyle)
          layer.closeTooltip()

          onNicheZoneSelected(feature.properties)
        },
      })
    },
  })
}
