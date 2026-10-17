import { useState } from 'react'
import { CircleUserRound, Clock3, ListMusic, Heart, Sparkles, Palette, LayoutGrid, Trash2, LogOut, Waves, AudioLines, Languages, MapPin, RefreshCw, MonitorDown } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useLibrary } from '../context/LibraryContext.jsx'
import { store, topGenre, ACCENTS, applySettings } from '../lib/store.js'
import { formatTime } from '../lib/audius.js'
import { checkForAppUpdates } from '../lib/updater.js'
import pkg from '../../package.json'
import { useT, tList, LANGS, REGIONS, getLang } from '../lib/i18n.js'

// Perfil: quién eres, cuánto escuchaste y ajustes de diseño tipo Spotify
function Profile() {
  const { user, signOut } = useAuth()
  const { likes, playlists } = useLibrary()
  const { t } = useT()
  const [settings, setSettings] = useState(() => store.settings)
  const [upState, setUpState] = useState({ phase: 'idle' }) // idle|checking|downloading|installing|uptodate|web|error

  const checkUpdates = async () => {
    setUpState({ phase: 'checking' })
    try {
      const res = await checkForAppUpdates((e) => {
        if (e.type === 'progress') {
          const p = e.total > 0 ? Math.round((e.downloaded / e.total) * 100) : 0
          setUpState({ phase: 'downloading', p })
        } else if (e.type === 'finished') setUpState({ phase: 'installing' })
      })
      if (!res.supported) setUpState({ phase: 'web' })
      else if (!res.available) setUpState({ phase: 'uptodate' })
      // Si hay update, la app se reinicia sola: no hace falta más estado.
    } catch {
      setUpState({ phase: 'error' })
    }
  }

  const history = store.history
  const totalPlays = history.length
  const totalSecs = history.reduce((a, h) => a + (h.track?.duration || 0), 0)
  const unique = new Set(history.map((h) => h.id)).size
  const favGenre = topGenre()
  const totalPlaylistTracks = playlists.reduce((a, p) => a + p.trackIds.length, 0)
  const accentNames = tList('pro.accentNames')

  const change = (patch) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    store.settings = next
    applySettings(next)
  }

  // Cambiar idioma recarga: mixes y etiquetas generadas nacen en tu idioma
  const changeLang = (lang) => {
    change({ lang })
    try { document.documentElement.lang = lang } catch {}
    setTimeout(() => window.location.reload(), 150)
  }

  const resetData = () => {
    if (!window.confirm(t('pro.confirmClear'))) return
    ;['sonder:likes', 'sonder:playlists', 'sonder:history', 'sonder:searches', 'sonder:queue', 'sonder:genres', 'sonder:followed', 'sonder:tracks', 'sonder:settings'].forEach((k) => {
      try { localStorage.removeItem(k) } catch {}
    })
    window.location.reload()
  }

  const initial = (user?.email || 'S')[0].toUpperCase()
  const avatar = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null

  return (
    <section className="content">
      <div className="profile-hero">
        <div className="profile-avatar">{avatar ? <img src={avatar} alt="" /> : <CircleUserRound size={40} />}</div>
        <div>
          <p className="hero-kicker2">{t('pro.profile')}</p>
          <h2 className="title-row">{user?.user_metadata?.full_name || user?.email?.split('@')[0] || t('pro.guest')}{!user && t('pro.noSession')}</h2>
          <p className="muted">{user ? user.email : t('pro.syncHint')}</p>
        </div>
        {user && <button className="icon-btn" onClick={signOut}><LogOut size={16} /> {t('header.logout')}</button>}
      </div>

      <div className="stats-grid">
        <div className="stat-card"><Clock3 size={20} /><strong>{formatTime(totalSecs)}</strong><small>{t('pro.listened')}</small></div>
        <div className="stat-card"><ListMusic size={20} /><strong>{totalPlays}</strong><small>{t('pro.playsSub', { n: unique })}</small></div>
        <div className="stat-card"><Heart size={20} /><strong>{likes.length}</strong><small>{t('pro.fav')}</small></div>
        <div className="stat-card"><LayoutGrid size={20} /><strong>{playlists.length}</strong><small>{t('pro.playlistsSub', { n: totalPlaylistTracks })}</small></div>
        <div className="stat-card"><Sparkles size={20} /><strong>{favGenre || '—'}</strong><small>{t('pro.topGenre')}</small></div>
      </div>

      <div className="lib-section">
        <h3><Languages size={16} /> {t('pro.language')}</h3>
        <p className="muted">{t('pro.languageSub')}</p>
        <div className="segmented">
          {Object.entries(LANGS).map(([k, name]) => (
            <button key={k} className={getLang() === k ? 'seg active' : 'seg'} onClick={() => changeLang(k)}>{name}</button>
          ))}
        </div>
        <p className="muted" style={{ marginTop: '0.8rem' }}><MapPin size={14} /> {t('pro.region')}</p>
        <p className="muted">{t('pro.regionSub')}</p>
        <div className="chips scroll-x">
          {REGIONS.map((r) => (
            <button key={r} className={settings.region === r ? 'chip active' : 'chip'} onClick={() => change({ region: r })}>{t(`w.${r}`)}</button>
          ))}
        </div>
      </div>

      <div className="lib-section">
        <h3><Palette size={16} /> {t('pro.design')}</h3>
        <p className="muted">{t('pro.accent')}</p>
        <div className="accent-row">
          {Object.entries(ACCENTS).map(([key, a], i) => (
            <button
              key={key}
              className={`accent-dot ${settings.accent === key ? 'active' : ''}`}
              style={{ background: a.acc }}
              onClick={() => change({ accent: key })}
              aria-label={accentNames[i] || a.name}
              title={accentNames[i] || a.name}
            />
          ))}
        </div>
        <p className="muted">{t('pro.density')}</p>
        <div className="segmented">
          <button className={settings.density === 'comfortable' ? 'seg active' : 'seg'} onClick={() => change({ density: 'comfortable' })}>{t('pro.comfy')}</button>
          <button className={settings.density === 'compact' ? 'seg active' : 'seg'} onClick={() => change({ density: 'compact' })}>{t('pro.compact')}</button>
        </div>
      </div>

      <div className="lib-section">
        <h3><Waves size={16} /> {t('pro.audio')}</h3>
        <p className="muted">{t('pro.crossfade')}</p>
        <div className="segmented">
          {[0, 3, 6, 12].map((s) => (
            <button key={s} className={settings.crossfade === s ? 'seg active' : 'seg'} onClick={() => change({ crossfade: s })}>
              {s === 0 ? 'Off' : `${s}s`}
            </button>
          ))}
        </div>
        <p className="muted" style={{ marginTop: '0.8rem' }}>{t('pro.radio')}</p>
        <div className="segmented">
          <button className={settings.automix ? 'seg active' : 'seg'} onClick={() => change({ automix: true })}>{t('pro.yes')}</button>
          <button className={!settings.automix ? 'seg active' : 'seg'} onClick={() => change({ automix: false })}>{t('pro.no')}</button>
        </div>
        <p className="muted" style={{ marginTop: '0.8rem' }}>{t('pro.quality')}</p>
        <div className="segmented">
          <button className={settings.quality === 'alta' ? 'seg active' : 'seg'} onClick={() => change({ quality: 'alta' })}>{t('pro.high')}</button>
          <button className={settings.quality === 'ahorro' ? 'seg active' : 'seg'} onClick={() => change({ quality: 'ahorro' })}>{t('pro.saver')}</button>
        </div>
        <p className="muted" style={{ marginTop: '0.4rem' }}>{t('pro.qualityNote')}</p>
        <p className="muted" style={{ marginTop: '0.8rem' }}>{t('pro.djVoice')}</p>
        <div className="segmented">
          <button className={settings.djVoice ? 'seg active' : 'seg'} onClick={() => change({ djVoice: true })}><AudioLines size={14} /> {t('pro.withVoice')}</button>
          <button className={!settings.djVoice ? 'seg active' : 'seg'} onClick={() => change({ djVoice: false })}>{t('pro.musicOnly')}</button>
        </div>
      </div>

      <div className="lib-section">
        <h3><MonitorDown size={16} /> {t('up.title')}</h3>
        <p className="muted">{t('up.sub', { v: pkg.version })}</p>
        <button className="icon-btn" onClick={checkUpdates} disabled={upState.phase === 'checking' || upState.phase === 'downloading' || upState.phase === 'installing'}>
          <RefreshCw size={16} className={upState.phase === 'checking' || upState.phase === 'downloading' ? 'spin' : ''} />
          {upState.phase === 'checking' ? t('up.checking')
            : upState.phase === 'downloading' ? t('up.downloading', { p: upState.p ?? 0 })
            : upState.phase === 'installing' ? t('up.installing')
            : t('up.check')}
        </button>
        {upState.phase === 'uptodate' && <p className="muted" style={{ marginTop: '0.5rem' }}>{t('up.uptodate')}</p>}
        {upState.phase === 'web' && <p className="muted" style={{ marginTop: '0.5rem' }}>{t('up.web')}</p>}
        {upState.phase === 'error' && <p className="error-inline" style={{ marginTop: '0.5rem' }}>{t('up.error')}</p>}
      </div>

      <div className="lib-section">
        <h3><Trash2 size={16} /> {t('pro.data')}</h3>
        <p className="muted">{t('pro.dataSub')}</p>
        <button className="icon-btn danger" onClick={resetData}><Trash2 size={16} /> {t('pro.clearData')}</button>
      </div>

      <p className="muted foot">{t('pro.foot', { i: initial })}</p>
    </section>
  )
}

export default Profile
