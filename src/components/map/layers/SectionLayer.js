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
            fillOpacity: 0.5,
        },

        onEachFeature(feature, layer) {
            layer.on('click', () => {
                const sectionId = feature.properties.id

                onSectionSelected(sectionId)
            })
        },

    })
}