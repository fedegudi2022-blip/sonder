import { useState } from 'react'
import { X, Mail, Lock, LogIn, UserPlus } from 'lucide-react'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.3H12v4.3h6.5c-.1 1.1-.8 2.7-2.4 3.8l-.1.1 3.5 2.7.1.1c2.1-2 3.9-4.9 3.9-8.7z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2-3.1 0-5.8-2.1-6.8-5l-.1.1-3.7 2.9v.1C3.4 21.5 7.4 24 12 24z" />
      <path fill="#FBBC05" d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4l-.1-.1-3.6-2.8-.1.1C.5 8.7 0 10.2 0 12s.5 3.3 1.4 4.7l3.8-2.3z" />
      <path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.4 0 3.4 2.5 1.4 6.8l3.8 2.9c1-2.9 3.7-5 6.8-5z" />
    </svg>
  )
}

function DiscordIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.3 4.4A19.8 19.8 0 0 0 15.9 3l-.2.5c1.8.4 2.6 1.1 2.6 1.1a15.7 15.7 0 0 0-3.5-1.1h-.1l-.1-.1a15.7 15.7 0 0 0-3.5 1.1s.9-.7 2.7-1.1L13.5 3a19.8 19.8 0 0 0-4.4 1.4C5.7 6.2 4.1 10 4 14.1c0 .1 0 .2.1.2 2 1.5 4 2.4 5.9 3l.5-.7c-1-.4-1.9-.9-2.8-1.5l.6-.4c2.7 1.2 5.6 1.2 8.3 0l.6.4c-.9.6-1.8 1.1-2.8 1.5l.5.7c1.9-.6 3.9-1.5 5.9-3 .1-.1.1-.2.1-.2 0-4.5-1.9-8.3-4.6-9.7zM8.7 12.5c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2zm6.6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2z" />
    </svg>
  )
}
import { useAuth } from '../context/AuthContext.jsx'
import { useT } from '../lib/i18n.js'

function AuthModal({ onClose }) {
  const [mode, setMode] = useState('login') // login | signup
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [ok, setOk] = useState(null)
  const { signIn, signUp, signInWithProvider, error, supabaseConfigured } = useAuth()
  const { t } = useT()
  const [oauthBusy, setOauthBusy] = useState(null)

  const oauth = async (provider) => {
    setOauthBusy(provider)
    await signInWithProvider(provider)
    setOauthBusy(null)
  }

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setOk(null)
    const fn = mode === 'login' ? signIn : signUp
    const done = await fn(email.trim(), password)
    setBusy(false)
    if (done) {
      if (mode === 'signup') setOk(t('auth.createdOk'))
      else onClose()
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label={t('auth.close')}><X size={18} /></button>
        <h2>{mode === 'login' ? t('auth.login') : t('auth.signup')}</h2>
        {!supabaseConfigured && (
          <p className="error">{t('auth.localMode')}</p>
        )}
        <div className="modal-tabs">
          <button className={mode === 'login' ? 'chip active' : 'chip'} onClick={() => setMode('login')}><LogIn size={14} /> {t('auth.enter')}</button>
          <button className={mode === 'signup' ? 'chip active' : 'chip'} onClick={() => setMode('signup')}><UserPlus size={14} /> {t('auth.register')}</button>
        </div>
        <form onSubmit={submit} className="auth-form">
          <label><Mail size={14} /> Email
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" />
          </label>
          <label><Lock size={14} /> {t('auth.password')}
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('auth.min6')} />
          </label>
          {error && <p className="error">{error}</p>}
          {ok && <p className="ok-msg">{ok}</p>}
          <button className="action-btn full" type="submit" disabled={busy}>
            {busy ? t('auth.wait') : mode === 'login' ? t('auth.enter') : t('auth.signup')}
          </button>
        </form>
        <div className="oauth-divider"><span>{t('auth.orContinue')}</span></div>
        <div className="oauth-row">
          <button className="oauth-btn" onClick={() => oauth('google')} disabled={oauthBusy !== null}>
            <GoogleIcon /> {oauthBusy === 'google' ? t('auth.opening') : 'Google'}
          </button>
          <button className="oauth-btn discord" onClick={() => oauth('discord')} disabled={oauthBusy !== null}>
            <DiscordIcon /> {oauthBusy === 'discord' ? t('auth.opening') : 'Discord'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AuthModal
