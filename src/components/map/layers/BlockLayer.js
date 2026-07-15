import Leaf from 'leaflet'

//-------------------------------------------------------------------------
//Esta función calcula el radio en metros a partir de un radio en píxeles, 
// dado un mapa y una ubicación (latlng).
function getMapRadiusFromPixels(mapInstance, latlng, pixelRadius) {
    
    const centerPoint = mapInstance.latLngToContainerPoint(latlng)
    const edgePoint = centerPoint.add([pixelRadius, 0])
    const edgeLatLng = mapInstance.containerPointToLatLng(edgePoint)

    return mapInstance.distance(latlng, edgeLatLng)
}
// RAZON DE FUNCION:
// Las manzanas VIP están almacenadas como Point en el GeoJSON.
// Se convierten en Circle para que escalen con el mapa como los poligonos.

//-------------------------------------------------------------------------

// Esta función crea una capa de bloques a partir de un objeto GeoJSON,
// un color para los bloques y una instancia del mapa en LeafletMap.
export function createBlockLayer(
    block, 
    blockColor, 
    mapInstance, 
    onBlockSelected,
) {
    return Leaf.geoJSON(block, {
        style: {
            color: blockColor,
            weight: 1,
            fill: true,
            fillOpacity: 0.5
        },

        // Esta función se llama para cada punto en la capa de bloques y 
        // crea un círculo con un radio calculado dinámicamente basado en 
        // el zoom del mapa.
        pointToLayer: function (feature, latlng) {
            const mapRadius = getMapRadiusFromPixels(
                mapInstance,
                latlng,
                12
            )

            // Se crea un círculo en la ubicación del bloque con el 
            // radio calculado y el color especificado.
            return Leaf.circle(latlng, {
                radius: mapRadius,
                color: blockColor,
                weight: 1,
                fill: false,
            })
        },

        onEachFeature(feature, layer) {
            layer.on('click', () => {
                onBlockSelected(feature.properties.manzana)
            })
        }

    })
}
