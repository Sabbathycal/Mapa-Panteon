import { InteractionRequiredAuthError, PublicClientApplication } from '@azure/msal-browser'

const clientId = import.meta.env.VITE_MS_CLIENT_ID
const tenantId = import.meta.env.VITE_MS_TENANT_ID

const graphScopes = ['User.Read', 'Sites.Read.All']

const msalConfig = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: window.location.origin + import.meta.env.BASE_URL,
    navigateToLoginRequestUrl: true,
  },

  cache: {
    cacheLocation: 'sessionStorage',
  },
}

let msalInstance = null
let initializationPromise = null

export async function initializeMsal() {
  if (msalInstance) {
    return msalInstance
  }

  if (!clientId || !tenantId) {
    throw new Error('Falta configurar Microsoft Entra ID.')
  }

  if (!initializationPromise) {
    initializationPromise = (async () => {
      const instance = new PublicClientApplication(msalConfig)

      await instance.initialize()

      const redirectResult = await instance.handleRedirectPromise()

      if (redirectResult?.account) {
        instance.setActiveAccount(redirectResult.account)
      } else {
        const activeAccount = instance.getActiveAccount()

        if (!activeAccount) {
          const accounts = instance.getAllAccounts()

          if (accounts.length > 0) {
            instance.setActiveAccount(accounts[0])
          }
        }
      }

      msalInstance = instance

      return instance
    })()
  }

  return initializationPromise
}

function waitForRedirect() {
  return new Promise(() => {})
}

export async function getGraphAccessToken() {
  const instance = await initializeMsal()

  const account = instance.getActiveAccount() ?? instance.getAllAccounts()[0] ?? null

  if (!account) {
    await instance.loginRedirect({
      scopes: graphScopes,
    })

    return waitForRedirect()
  }

  try {
    const response = await instance.acquireTokenSilent({
      account,
      scopes: graphScopes,
    })

    return response.accessToken
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      await instance.acquireTokenRedirect({
        account,
        scopes: graphScopes,
      })

      return waitForRedirect()
    }

    throw error
  }
}
