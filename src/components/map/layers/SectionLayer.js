import Leaf from 'leaflet'

export function createSectionLayer(
    sections, 
    sectionColor,
    onSectionSelected,
) {
    return Leaf.geoJSON(sections, {
        style: {
            color: sectionColor,
            weight: 2,
            fill: true,
            fillOpacity: 0.001,
        },

        onEachFeature(feature, layer) {
            const originalStyle = {
                color: sectionColor,
                weight: 2,
                fill: true,
                fillOpacity: 0.001,
            }

            layer.on({
                mouseover() {
                    layer.setStyle({
                        color: feature.properties.color,
                        weight: 3, 
                        fill: true,
                        fillOpacity: 0.25,
                    })
                
                    layer.bindTooltip(feature.properties.nombre, {
                        permanent: false,
                        direction: 'center',
                        className: 'section-tooltip',
                    }).openTooltip()
                },

                mouseout() {
                layer.setStyle(originalStyle)
                layer.closeTooltip()
                },

                click() {

                    layer.setStyle(originalStyle)
                    layer.closeTooltip()

                    onSectionSelected(feature.properties.id)
                }
             })
        },
    })
}