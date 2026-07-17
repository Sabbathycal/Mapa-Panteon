export function filterBlockbySection(blocks, sectionId) {
  return {
    type: 'FeatureCollection',
    features: blocks.features.filter((block) => block.properties.seccion === sectionId),
  }
}

export function filterLotsbyBlocks(lots, sectionId, blockId) {
  return {
    type: 'FeatureCollection',
    features: lots.features.filter(
      (lot) => lot.properties.seccion === sectionId && lot.properties.manzana === blockId,
    ),
  }
}
