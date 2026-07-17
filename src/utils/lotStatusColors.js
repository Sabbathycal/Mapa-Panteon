const lotStatusVariables = {
  disponible: '--color-lot-available',
  vendido: '--color-lot-sold',
  utilizado: '--color-lot-used',
  separado: '--color-lot-reserved',
}

function getCSSVar(varName) {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
}

export function getLotColorByStatus(status) {
  const normalizedStatus = status?.trim().toLowerCase()

  const varName = lotStatusVariables[normalizedStatus] ?? '--color-lot-unknown'

  return getCSSVar(varName)
}
