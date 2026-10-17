import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase, supabaseConfigured } from '../lib/supabase.js'
import { t } from '../lib/i18n.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(supabaseConfigured)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!supabaseConfigured) { setLoading(false); return }
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user || null)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user || null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const signUp = useCallback(async (email, password) => {
    setError(null)
    if (!supabaseConfigured) { setError(t('auth.noSupabase')); return false }
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) { setError(error.message); return false }
    return true
  }, [])

  const signIn = useCallback(async (email, password) => {
    setError(null)
    if (!supabaseConfigured) { setError(t('auth.noSupabase')); return false }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); return false }
    return true
  }, [])

  const signOut = useCallback(async () => {
    if (supabaseConfigured) await supabase.auth.signOut()
    setUser(null)
  }, [])

  // OAuth: en la web redirige normal; en el .exe abre el navegador del
  // sistema y la sesión vuelve por sonder:// (localhost muere en desktop).
  // La sesión llega por onAuthStateChange; los errores del callback por evento.
  useEffect(() => {
    if (!supabaseConfigured) return
    let alive = true
    import('../lib/desktopAuth.js').then((m) => {
      if (alive) m.installOAuthDeepLinkHandler().catch(() => {})
    }).catch(() => {})
    const onErr = (ev) => { if (alive && ev.detail) setError(ev.detail) }
    window.addEventListener('sonder:oauth-error', onErr)
    return () => { alive = false; window.removeEventListener('sonder:oauth-error', onErr) }
  }, [])

  const signInWithProvider = useCallback(async (provider) => {
    setError(null)
    if (!supabaseConfigured) { setError(t('auth.noSupabase')); return false }
    // Rama desktop (con plugins Tauri): no navega el WebView.
    try {
      const { isDesktopApp, signInWithProviderDesktop } = await import('../lib/desktopAuth.js')
      if (await isDesktopApp()) {
        await signInWithProviderDesktop(provider)
        setError(t('auth.desktopBrowser')) // aviso, no error: completa en el navegador
        return true
      }
    } catch (e) {
      if (e?.message && e.message !== 'desktop-missing') { setError(e.message); return false }
    }
    // Rama web: redirect clásico a window.location.origin.
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    })
    if (error) { setError(error.message); return false }
    return true
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, error, signUp, signIn, signOut, signInWithProvider, supabaseConfigured }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth dentro de AuthProvider')
  return ctx
}
