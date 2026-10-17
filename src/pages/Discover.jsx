import { useEffect, useState, useCallback, useRef } from 'react'
import { Sparkles, CalendarDays, CalendarRange, Clock3, Radio, Play, Pause, Loader2, HeartOff, Undo2, Volume2 } from 'lucide-react'
import SongCard from '../components/SongCard.jsx'
import { usePlayer } from '../context/PlayerContext.jsx'
import { useLibrary } from '../context/LibraryContext.jsx'
import { getDailyMix, getWeeklyDiscovery, getDaylist } from '../lib/discover.js'
import { tasteSummary, getExcluded, unexclude } from '../lib/taste.js'
import { voiceSupported, speak } from '../lib/dj.js'
import { store, topGenre } from '../lib/store.js'
import { useT } from '../lib/i18n.js'

// Descubrir: Daily Mix, Semanal, Daylist, AI DJ y tu Taste Profile
function Discover() {
  const { playTrack, setQueue, dj, setDjMode, current, isPlaying, toggle } = usePlayer()
  const { getTrackCache } = useLibrary()
  const [daily, setDaily] = useState(null)
  const [weekly, setWeekly] = useState(null)
  const [daylist, setDaylist] = useState(null)
  const [loading, setLoading] = useState(true)
  const { t } = useT()
  const [taste, setTaste] = useState(() => tasteSummary())
  const [excluded, setExcluded] = useState(() => getExcluded())

  useEffect(() => {
    let alive = true
    setLoading(true)
    const cache = getTrackCache()
    const likedTracks = Object.values(cache).slice(0, 60)
    Promise.all([getDailyMix(likedTracks), getWeeklyDiscovery(), getDaylist()])
      .then(([d, w, dl]) => {
        if (!alive) return
        setDaily(d); setWeekly(w); setDaylist(dl)
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const refreshTaste = useCallback(() => {
    setTaste(tasteSummary())
    setExcluded(getExcluded())
  }, [])

  // Qué mix está sonando (para que su botón sea pausa en vez de reiniciar)
  const [activeMix, setActiveMix] = useState(null) // daily | weekly | daylist | dj
  const lastStart = useRef(0)
  const mixOf = {
    daily: daily || [],
    weekly: weekly?.tracks || [],
    daylist: daylist?.tracks || [],
  }
  const soundsLike = (tracks) => current && (tracks || []).some((t) => t.id === current.id)

  // Si lo que suena ya no es del mix activo (el usuario puso otra cosa), soltarlo
  useEffect(() => {
    if (!activeMix || !current) return
    const pool = activeMix === 'dj'
      ? [...(daily || []), ...(daylist?.tracks || [])]
      : mixOf[activeMix] || []
    if (!pool.some((t) => t.id === current.id)) setActiveMix(null)
  }, [current?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const playMix = (key, tracks, djOn = false) => {
    // Mismo mix sonando → pausa/continúa (no reinicia). Anti doble-click.
    if (activeMix === (djOn ? 'dj' : key) && soundsLike(djOn ? [...(daily || []), ...(daylist?.tracks || [])] : tracks)) {
      if (Date.now() - lastStart.current < 500) return // doble-click: no pausar lo recién iniciado
      toggle()
      return
    }
    if (Date.now() - lastStart.current < 800 || !tracks?.length) return
    lastStart.current = Date.now()
    setDjMode(djOn)
    setActiveMix(djOn ? 'dj' : key)
    setQueue(tracks)
    playTrack(tracks[0], tracks)
  }

  // El DJ habla UNA sola vez al iniciar (voz amable) y después deja solo la música.
  // Al detenerlo, la música también se detiene.
  const toggleDj = () => {
    if (dj) {
      setDjMode(false)
      setActiveMix(null)
      if (isPlaying) toggle()
      return
    }
    const pool = [...(daily || []), ...(daylist?.tracks || [])]
    if (!pool.length) return
    if (voiceSupported() && store.settings.djVoice) {
      const g = topGenre()
      speak(g ? t('dis.djGreeting', { g }) : t('dis.djGreetingAlt'))
    }
    playMix('dj', pool.slice(0, 20), true)
  }

  const maxCount = Math.max(1, ...taste.genres.map((g) => g.count))

  return (
    <section className="content">
      <div className="page-head">
        <div className="page-titles">
          <h2 className="title-row"><Sparkles size={22} /> {t('dis.title')}</h2>
          <p className="muted head-count">{t('dis.sub')}</p>
        </div>
      </div>

      {/* AI DJ */}
      <div className="dj-panel">
        <span className="dj-icon"><Radio size={22} /></span>
        <div className="dj-meta">
          <strong>AI DJ {dj && current ? `• ${current.title}` : ''}</strong>
          <small>{dj ? t('dis.djOn') : t('dis.djOff')}</small>
        </div>
        <button className="action-btn" onClick={toggleDj} disabled={loading && !dj && !(daily?.length || daylist?.tracks?.length)}>
          {dj ? <><Pause size={16} /> {t('dis.stopDj')}</> : <><Play size={16} /> {t('dis.startDj')}</>}
        </button>
      </div>
      {!voiceSupported() && <p className="muted"><Volume2 size={14} /> {t('dis.noVoice')}</p>}

      {loading && <p className="muted loading"><Loader2 size={18} className="spin" /> {t('dis.building')}</p>}

      <div className="mix-grid">
        <div className="mix-card m0">
          <p className="hero-kicker2"><CalendarDays size={14} /> Daily Mix</p>
          <h3>{t('dis.todayMix')}</h3>
          <small>{daily ? t('dis.dailySub', { n: daily.length }) : t('dis.dailyAlt')}</small>
          <button className="mix-play" onClick={() => playMix('daily', daily)} disabled={!daily?.length} aria-label={activeMix === 'daily' ? t('dis.pauseMix', { name: 'Daily Mix' }) : t('dis.playMix', { name: 'Daily Mix' })}>
            {activeMix === 'daily' && soundsLike(daily) && isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </button>
        </div>
        <div className="mix-card m1">
          <p className="hero-kicker2"><CalendarRange size={14} /> {t('dis.weekly')}</p>
          <h3>{t('dis.weeklyTitle')}</h3>
          <small>{weekly ? t('dis.weeklySub', { g: weekly.genres.join(' • ') }) : t('dis.weeklyAlt')}</small>
          <button className="mix-play" onClick={() => playMix('weekly', weekly?.tracks)} disabled={!weekly?.tracks?.length} aria-label={activeMix === 'weekly' ? t('dis.pauseMix', { name: t('dis.weekly') }) : t('dis.playMix', { name: t('dis.weekly') })}>
            {activeMix === 'weekly' && soundsLike(weekly?.tracks) && isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </button>
        </div>
        <div className="mix-card m2">
          <p className="hero-kicker2"><Clock3 size={14} /> Daylist</p>
          <h3>{daylist ? daylist.name : t('dis.daylistAlt')}</h3>
          <small>{daylist ? daylist.desc : t('dis.daylistAltSub')}</small>
          <button className="mix-play" onClick={() => playMix('daylist', daylist?.tracks)} disabled={!daylist?.tracks?.length} aria-label={activeMix === 'daylist' ? t('dis.pauseMix', { name: 'Daylist' }) : t('dis.playMix', { name: 'Daylist' })}>
            {activeMix === 'daylist' && soundsLike(daylist?.tracks) && isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </button>
        </div>
      </div>

      {daylist?.tracks?.length > 0 && (
        <div className="rec-section">
          <h3 className="title-row small"><Clock3 size={18} /> {t('dis.nowHour')}</h3>
          <div className="grid">{daylist.tracks.slice(0, 8).map((c) => <SongCard key={c.id} cancion={c} lista={daylist.tracks} />)}</div>
        </div>
      )}

      {/* Taste Profile */}
      <div className="rec-section">
        <h3 className="title-row small"><Sparkles size={18} /> {t('dis.taste')}</h3>
        <p className="muted">{t('dis.tasteSub')}</p>
        {taste.genres.length === 0
          ? <p className="muted">{t('dis.tasteEmpty')}</p>
          : (
            <div className="taste-bars">
              {taste.genres.map((g) => (
                <div key={g.genre} className="taste-row">
                  <span>{g.genre}</span>
                  <div className="taste-track"><div className="taste-fill" style={{ width: `${Math.round((g.count / maxCount) * 100)}%` }} /></div>
                  <small>{g.count}</small>
                </div>
              ))}
            </div>
          )}
        <h3 className="title-row small" style={{ marginTop: '1rem' }}><HeartOff size={16} /> {t('dis.excluded', { n: excluded.length })}</h3>
        {excluded.length === 0
          ? <p className="muted">{t('dis.excludedEmpty')}</p>
          : excluded.map((x) => (
            <div key={x.id} className="queue-row">
              <span className="queue-item"><span className="q-meta"><strong>{x.title}</strong><small>{x.artist}</small></span></span>
              <button className="icon-btn xs" onClick={() => { unexclude(x.id); refreshTaste() }} title={t('dis.backIn')}><Undo2 size={14} /></button>
            </div>
          ))}
      </div>

      <p className="muted foot">{t('dis.foot')}</p>
    </section>
  )
}

export default Discover
