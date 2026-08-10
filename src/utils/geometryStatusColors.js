const geometryStatusVariables = {
  disponible: '--color-status-available',
  vendido: '--color-status-sold',
  ocupado: '--color-status-used',
  separado: '--color-status-reserved',
  suspendido: '--color-status-suspended',
  por_construir: '--color-status-unbuilt',
}

function getCSSVar(varName) {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
}

export function getGeometryColorByStatus(status) {
  const normalizedStatus = status?.trim().toLowerCase()

  const varName = geometryStatusVariables[normalizedStatus] ?? '--color-status-unknown'

  return getCSSVar(varName)
}
