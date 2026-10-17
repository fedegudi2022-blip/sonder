// Login OAuth en el .exe: el WebView no puede recibir el retorno de
// Discord/Google (localhost muere), así que el flujo se completa en el
// navegador del sistema y vuelve por deep link sonder://auth/callback.
// En la web este módulo no hace nada: el redirect normal sigue intacto.
import { supabase } from './supabase.js'

export const DESKTOP_REDIRECT = 'sonder://auth/callback'

let modsPromise = null
function loadMods() {
  if (!modsPromise) {
    modsPromise = Promise.all([
      import('@tauri-apps/plugin-opener'),
      import('@tauri-apps/plugin-deep-link'),
    ]).then(([opener, deepLink]) => ({ opener, deepLink })).catch(() => null)
  }
  return modsPromise
}

export async function isDesktopApp() {
  return !!(await loadMods())
}

const seenCodes = new Set()

async function handleUrls(urls) {
  for (const raw of urls || []) {
    let url
    try { url = new URL(raw) } catch { continue }
    // Solo nuestro callback: otra app podría invocar el esquema.
    if (url.protocol !== 'sonder:' || url.hostname !== 'auth' || url.pathname !== '/callback') continue
    const err = url.searchParams.get('error_description') || url.searchParams.get('error')
    if (err) {
      window.dispatchEvent(new CustomEvent('sonder:oauth-error', { detail: err }))
      continue
    }
    const code = url.searchParams.get('code')
    if (!code || seenCodes.has(code)) continue
    seenCodes.add(code)
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    window.dispatchEvent(new CustomEvent('sonder:oauth-done', { detail: error ? error.message : null }))
  }
}

// Llamar una vez al arrancar: escucha links y revisa si Windows nos abrió con uno.
export async function installOAuthDeepLinkHandler() {
  const mods = await loadMods()
  if (!mods) return false
  await mods.deepLink.onOpenUrl(handleUrls)
  try {
    const initial = await mods.deepLink.getCurrent()
    if (initial) await handleUrls(initial)
  } catch {}
  return true
}

// Inicia el OAuth en el navegador del sistema (no navega el WebView).
export async function signInWithProviderDesktop(provider) {
  const mods = await loadMods()
  if (!mods) throw new Error('desktop-missing')
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: DESKTOP_REDIRECT, skipBrowserRedirect: true },
  })
  if (error) throw error
  if (!data?.url) throw new Error('no-url')
  await mods.opener.openUrl(data.url)
}
