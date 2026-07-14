import sectionURL from '@/assets/data/secciones.geojson?url';


async function getSections() {
    const response = await fetch(sectionURL);

    if (!response.ok) {
        throw new Error('No fue posible cargar la geometria de las secciones')
    }

    return response.json()
}

export const GeometryService = {
    getSections
}