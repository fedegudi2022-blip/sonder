import { useState, useEffect, useRef } from 'react'
import { X, Languages, Music2 } from 'lucide-react'
import { usePlayer } from '../context/PlayerContext.jsx'
import { activeLine } from '../lib/lyrics.js'
import { translateLines } from '../lib/translate.js'
import { useT } from '../lib/i18n.js'

// Karaoke a pantalla completa: la línea activa en grande, anterior/siguiente
// tenues, auto-scroll, clic en una línea para saltar a ese momento y
// traducción al español cuando la letra viene en otro idioma.
function Karaoke({ track, lyrics, onClose }) {
  const { currentTime, seek } = usePlayer()
  const { t } = useT()
  const [showEs, setShowEs] = useState(false)
  const [esLines, setEsLines] = useState(null)
  const [trState, setTrState] = useState('idle') // idle | loading | error | done | unnecessary
  const box = useRef(null)
  const lines = lyrics?.lines || []
  const synced = !!lyrics?.synced
  // Offset manual de sincronía (la letra de LRCLIB a veces viene corrida):
  // se suma al tiempo actual y persiste entre sesiones.
  const [offset, setOffset] = useState(() => {
    try { return Number(localStorage.getItem('sonder:lyricOffset') || 0) || 0 } catch { return 0 }
  })
  const idx = synced ? activeLine(lines, currentTime + offset) : -1
  const nudge = (d) => {
    setOffset((o) => {
      const c = Math.max(-10, Math.min(10, Math.round((o + d) * 10) / 10))
      try { localStorage.setItem('sonder:lyricOffset', String(c)) } catch {}
      return c
    })
  }
  const trackKey = `${track?.artist} — ${track?.title}`.toLowerCase()

  // Escape cierra; el fondo sigue sonando
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose])

  // Traduce una sola vez por tema (con caché en memoria + localStorage)
  useEffect(() => {
    let alive = true
    setEsLines(null); setTrState('idle'); setShowEs(false)
    if (!lines.length) return
    setTrState('loading')
    translateLines(lines, trackKey)
      .then((out) => {
        if (!alive) return
        if (out === null) { setTrState('unnecessary'); return } // ya en español
        setEsLines(out); setTrState('done')
      })
      .catch(() => { if (alive) setTrState('error') })
    return () => { alive = false }
  }, [trackKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // La línea activa siempre visible y centrada
  useEffect(() => {
    const el = box.current?.querySelector('.k-line.active')
    if (el) box.current.scrollTo({ top: el.offsetTop - box.current.clientHeight / 2 + 60, behavior: 'smooth' })
  }, [idx])

  const shown = (i) => (showEs && esLines?.[i] ? esLines[i] : lines[i]?.text || '♪')
  // Ventana: 1 anterior + activa + las que siguen (karaoke clásico)
  const from = Math.max(0, idx - 1)
  const visible = lines.slice(from, from + 7)

  return (
    <div className="karaoke" role="dialog" aria-label={t('k.of', { t: track?.title })}>
      <div className="k-top">
        <div className="k-track">
          {track?.artwork ? <img src={track.artwork} alt="" /> : <Music2 size={22} />}
          <div>
            <strong>{track?.title}</strong>
            <small>{track?.artist}</small>
          </div>
        </div>
        <div className="k-actions">
          {(trState === 'done' || trState === 'loading') && (
            <button
              className={`icon-btn${showEs ? ' on' : ''}`}
              onClick={() => setShowEs(!showEs)}
              disabled={trState !== 'done'}
              title={trState === 'done' ? (showEs ? t('k.showOriginal') : t('k.showEs')) : t('k.translating')}
            >
              <Languages size={16} /> {trState === 'done' ? (showEs ? 'ES' : 'EN') : '…'}
            </button>
          )}
          {synced && (
            <span className="k-sync" title={t('k.syncTitle')}>
              <button className="icon-btn" onClick={() => nudge(-0.5)} aria-label={t('k.syncBack')}>−0.5s</button>
              {offset !== 0 && <button className="icon-btn on" onClick={() => nudge(-offset)} aria-label={t('k.syncReset')}>{offset > 0 ? '+' : ''}{offset}s</button>}
              <button className="icon-btn" onClick={() => nudge(0.5)} aria-label={t('k.syncFwd')}>+0.5s</button>
            </span>
          )}
          <button className="icon-btn" onClick={onClose} aria-label={t('k.close')}><X size={18} /></button>
        </div>
      </div>
      {trState === 'error' && <p className="k-note">{t('k.trError')}</p>}
      <div className="k-body" ref={box}>
        {!lines.length && <p className="muted">{t('k.noLyrics')}</p>}
        {!synced && lines.length > 0 && <p className="k-note">{t('k.noTime')}</p>}
        {visible.map((l) => {
          const i = lines.indexOf(l)
          const cls = i === idx ? 'k-line active' : i < idx ? 'k-line past' : 'k-line'
          return (
            <button key={i} className={cls} onClick={() => l.t >= 0 && seek(l.t + 0.01)} title={l.t >= 0 ? t('k.jump') : ''}>
              <span className="k-main">{shown(i)}</span>
              {showEs && esLines?.[i] && <span className="k-sub">{lines[i]?.text}</span>}
            </button>
          )
        })}
      </div>
      <p className="k-hint">{t('k.hint')}</p>
    </div>
  )
}

export default Karaoke
