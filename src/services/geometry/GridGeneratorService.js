function rotatePoint(x, y, centerX, centerY, angleInDegrees) {
  if (angleInDegrees === 0) {
    return [y, x]
  }

  const angle = (angleInDegrees * Math.PI) / 180

  const translatedX = x - centerX
  const translatedY = y - centerY

  const rotatedX = translatedX * Math.cos(angle) - translatedY * Math.sin(angle)

  const rotatedY = translatedX * Math.sin(angle) + translatedY * Math.cos(angle)

  return [rotatedY + centerY, rotatedX + centerX]
}

function createCellFeature({ id, row, column, number, zone, side, geometryType, coordinates }) {
  return {
    type: 'Feature',

    properties: {
      id,
      row,
      column,
      number,
      zone,
      side,
      geometryType,
      status: 'available',
    },

    geometry: {
      type: 'Polygon',
      coordinates: [
        [...coordinates.map(([lat, lng]) => [lng, lat]), [coordinates[0][1], coordinates[0][0]]],
      ],
    },
  }
}

function generateGridFeatureCollection({
  center,
  rows,
  columns,
  cellWidth,
  cellHeight,
  spacingX,
  spacingY,
  rotation = 0,
  startNumber = 1,
  geometryType,
  zone = null,
  side = null,
}) {
  const features = []

  const totalWidth = columns * cellWidth + (columns - 1) * spacingX

  const totalHeight = rows * cellHeight + (rows - 1) * spacingY

  const startX = center.lng - totalWidth / 2
  const startY = center.lat + totalHeight / 2

  let currentNumber = startNumber

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const left = startX + column * (cellWidth + spacingX)

      const right = left + cellWidth

      const top = startY - row * (cellHeight + spacingY)

      const bottom = top - cellHeight

      const coordinates = [
        rotatePoint(left, top, center.lng, center.lat, rotation),

        rotatePoint(right, top, center.lng, center.lat, rotation),

        rotatePoint(right, bottom, center.lng, center.lat, rotation),

        rotatePoint(left, bottom, center.lng, center.lat, rotation),
      ]

      const paddedNumber = String(currentNumber).padStart(3, '0')

      features.push(
        createCellFeature({
          id: `TEMP-${paddedNumber}`,
          row,
          column,
          number: paddedNumber,
          zone,
          side,
          geometryType,
          coordinates,
        }),
      )

      currentNumber++
    }
  }

  return {
    type: 'FeatureCollection',
    features,
  }
}

export const GridGeneratorService = {
  generateGridFeatureCollection,
}
