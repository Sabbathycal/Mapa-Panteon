export function exportGeoJSON(featureCollection, fileName) {
  if (!featureCollection?.features?.length) {
    return
  }

  const json = JSON.stringify(featureCollection, null, 2)

  const blob = new Blob([json], {
    type: 'application/geo+json',
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = fileName.endsWith('.geojson') ? fileName : `${fileName}.geojson`

  document.body.appendChild(link)
  link.click()
  link.remove()

  URL.revokeObjectURL(url)
}
