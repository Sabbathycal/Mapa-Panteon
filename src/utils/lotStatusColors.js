const lotStatusVariables = {
  disponible: '--color-status-available',
  vendido: '--color-status-sold',
  ocupado: '--color-status-used',
  separado: '--color-status-reserved',
}

function getCSSVar(varName) {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
}

export function getLotColorByStatus(status) {
  const normalizedStatus = status?.trim().toLowerCase()

  const varName = lotStatusVariables[normalizedStatus] ?? '--color-status-unknown'

  return getCSSVar(varName)
}
