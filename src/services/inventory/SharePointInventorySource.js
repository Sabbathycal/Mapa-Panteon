import { getGraphAccessToken } from '@/services/auth/MsalService'
import { normalizeInventoryRow } from './InventoryNormalizer'

const siteId = import.meta.env.VITE_MS_SITE_ID
const listId = import.meta.env.VITE_MS_LIST_ID

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0'

const MAX_RETRIES = 3
const RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504]

function validateConfiguration() {
  if (!siteId || !listId) {
    throw new Error('Falta configurar el sitio o la lista de SharePoint.')
  }
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function getRetryDelay(response, attempt) {
  const retryAfter = response.headers.get('Retry-After')

  if (retryAfter) {
    const seconds = Number(retryAfter)

    if (Number.isFinite(seconds)) {
      return seconds * 1000
    }
  }

  // 1s, 2s, 4s...
  return 1000 * 2 ** attempt
}

function parseSharePointDate(value) {
  const text = String(value ?? '').trim()

  if (!text) {
    return null
  }

  const date = new Date(text)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date
}

function formatInventoryDate(date) {
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
    .format(date)
    .replace('a. m.', 'a. m.')
    .replace('p. m.', 'p. m.')
}

function getLatestInventoryUpdate(rows) {
  let latestDate = null

  for (const row of rows) {
    const parsedDate = parseSharePointDate(row.Fecha_Actualizacion)

    if (parsedDate && (!latestDate || parsedDate > latestDate)) {
      latestDate = parsedDate
    }
  }

  return latestDate ? formatInventoryDate(latestDate) : null
}

async function fetchGraphPage(url, accessToken) {
  let lastError = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      })

      if (response.ok) {
        return await response.json()
      }

      const error = new Error(`Microsoft Graph respondió ${response.status} ${response.statusText}`)

      error.status = response.status
      lastError = error

      const canRetry = RETRYABLE_STATUS_CODES.includes(response.status) && attempt < MAX_RETRIES

      if (!canRetry) {
        throw error
      }

      const delay = getRetryDelay(response, attempt)

      console.warn(
        `[Inventory] Graph respondió ${response.status}. ` +
          `Reintentando en ${Math.round(delay / 1000)} s...`,
      )

      await wait(delay)
    } catch (error) {
      lastError = error

      // Si es un error HTTP que nosotros mismos generamos
      if (error?.status) {
        throw error
      }

      // Error de red, DNS, conexión, etc.
      if (attempt >= MAX_RETRIES) {
        throw error
      }

      const delay = 1000 * 2 ** attempt

      console.warn(
        `[Inventory] Error de red al consultar Graph. ` +
          `Reintento ${attempt + 1}/${MAX_RETRIES} en ` +
          `${Math.round(delay / 1000)} s...`,
        error,
      )

      await wait(delay)
    }
  }

  throw lastError ?? new Error('Error desconocido al consultar Microsoft Graph.')
}

export async function loadInventoryFromSharePoint() {
  validateConfiguration()

  const accessToken = await getGraphAccessToken()

  if (!accessToken) {
    throw new Error('No hay una sesión de Microsoft disponible.')
  }

  let nextUrl = `${GRAPH_BASE_URL}/sites/${siteId}` + `/lists/${listId}/items?$expand=fields`

  const rows = []

  while (nextUrl) {
    const data = await fetchGraphPage(nextUrl, accessToken)

    for (const item of data.value ?? []) {
      if (item.fields) {
        rows.push(item.fields)
      }
    }

    nextUrl = data['@odata.nextLink'] ?? null
  }

  const records = rows.map(normalizeInventoryRow).filter((record) => record.referenceId)

  if (records.length === 0) {
    throw new Error('SharePoint respondió correctamente, pero no devolvió registros utilizables.')
  }

  return {
    records,
    source: 'sharepoint',
    lastUpdatedAt: getLatestInventoryUpdate(rows),
  }
}
