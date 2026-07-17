import sectionURL from '@/assets/data/secciones.geojson?url'
import blocksURL from '@/assets/data/manzanas.geojson?url'
import nicheZonesURL from '@/assets/data/nichos/nichos-zonas.geojson?url'

//--------------------------------------------------------------
// Este servicio se encarga de obtener la geometría de las secciones
// y manzanas del panteón
import bronceLotsUrl from '@/assets/data/lotes/bronce/lotes.geojson?url'
import oroLotsUrl from '@/assets/data/lotes/oro/lotes.geojson?url'
import plataLotsUrl from '@/assets/data/lotes/plata/lotes.geojson?url'
import platinoLotsUrl from '@/assets/data/lotes/platino/lotes.geojson?url'
import sanJuanVipLotsUrl from '@/assets/data/lotes/sanjuanvip/lotes.geojson?url'
import sanMateoVipLotsUrl from '@/assets/data/lotes/sanmateovip/lotes.geojson?url'
import sanPedroVipLotsUrl from '@/assets/data/lotes/sanpedrovip/lotes.geojson?url'
//WHY: No quise juntar todos los lotes.geojson en un solo archivo
// porque me dio flojera.

// Esta constante contiene las URLs de los archivos GeoJSON de los lotes,
// que se utilizarán para obtener la geometría de los lotes.
const lotUrls = [
  bronceLotsUrl,
  oroLotsUrl,
  plataLotsUrl,
  platinoLotsUrl,
  sanJuanVipLotsUrl,
  sanMateoVipLotsUrl,
  sanPedroVipLotsUrl,
]
//--------------------------------------------------------------

//Cada funcion obtiene la geometria de las secciones, manzanas y lotes del
// panteon desde un archivo geojson y lo retorna en formato JSON.
// Si hay un error en la carga del archivo, lanza un error con un mensaje descriptivo.
async function getSections() {
  const response = await fetch(sectionURL)

  if (!response.ok) {
    throw new Error('No fue posible cargar la geometria de las secciones')
  }

  return response.json()
}

async function getBlocks() {
  const response = await fetch(blocksURL)

  if (!response.ok) {
    throw new Error('No fue posible cargar la geometria de las manzanas')
  }

  return response.json()
}

async function getLots() {
  const responses = await Promise.all(
    lotUrls.map(async (lotUrl) => {
      const response = await fetch(lotUrl)
      if (!response.ok) {
        throw new Error(`No fue posible cargar la geometria de los lotes desde ${lotUrl}`)
      }

      return response.json()
    }),
  )

  return {
    type: 'FeatureCollection',
    features: responses.flatMap((geojson) => geojson.features),
  }
}

async function getNicheZones() {
  const response = await fetch(nicheZonesURL)

  if (!response.ok) {
    throw new Error('No fue posible cargar las zonas de nichos.')
  }

  return response.json()
}

export const GeometryService = {
  getSections,
  getBlocks,
  getLots,
  getNicheZones,
}
