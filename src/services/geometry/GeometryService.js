import sectionURL from '@/assets/data/secciones.geojson?url';
import blocksURL from '@/assets/data/manzanas.geojson?url';

//Cada funcion obtiene la geometria de las secciones y manzanas del panteon 
//desde un archivo geojson y lo retorna en formato json
async function getSections() {
    const response = await fetch(sectionURL);

    if (!response.ok) {
        throw new Error('No fue posible cargar la geometria de las secciones')
    }

    return response.json()
}

async function getBlocks() {
    const response = await fetch(blocksURL);

    if (!response.ok) {
        throw new Error('No fue posible cargar la geometria de las manzanas')
    }

    return response.json()
}

export const GeometryService = {
    getSections,
    getBlocks
}