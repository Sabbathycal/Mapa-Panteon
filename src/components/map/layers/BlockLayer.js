import Leaf from 'leaflet'

function getMapRadiusFromPixels(mapInstance, latlng, pixelRadius) {
    const centerPoint = mapInstance.latLngToContainerPoint(latlng)

    const edgePoint = centerPoint.add([pixelRadius, 0])
    const edgeLatLng = mapInstance.containerPointToLatLng(edgePoint)

    return mapInstance.distance(latlng, edgeLatLng)
}

export function createBlockLayer(block, blockColor, mapInstance) {
    return Leaf.geoJSON(block, {
        style: {
            color: blockColor,
            weight: 1,
            fill: false,
        },

        pointToLayer: function (feature, latlng) {
            const mapRadius = getMapRadiusFromPixels(
                mapInstance,
                latlng,
                12
            )

            return Leaf.circle(latlng, {
                radius: mapRadius,
                color: blockColor,
                weight: 1,
                fill: false,
            })
        },
    })
}
