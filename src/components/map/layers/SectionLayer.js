import Leaf from 'leaflet'

export function createSectionLayer(sections, sectionColor) {
    return Leaf.geoJSON(sections, {
        style: {
            color: sectionColor,
            weight: 2,
            fill: false,
        }
    })
}