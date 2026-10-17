import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Play, Pause, SkipBack, SkipForward, Volume1, Volume2, VolumeX, Heart, Music2, Shuffle, Repeat, Repeat1, ListMusic, X, Timer, ListPlus, GripVertical, Maximize2 } from 'lucide-react'
import { usePlayer } from '../context/PlayerContext.jsx'
import { useLibrary } from '../context/LibraryContext.jsx'
import { formatTime, getTrackDetail } from '../lib/audius.js'
import { getLyrics, activeLine } from '../lib/lyrics.js'
import Karaoke from './Karaoke.jsx'
import { store, applySettings } from '../lib/store.js'
import { useT, getLang } from '../lib/i18n.js'

function PlayerBar() {
  const { current, queue, index, isPlaying, toggle, next, prev, volume, setVolume, currentTime, duration, seek, shuffle, setShuffle, repeat, cycleRepeat, audioError, playTrack, removeAt, clearUpNext, moveQueue, removeMany, sleepLeft, setSleep } = usePlayer()
  const [panelTab, setPanelTab] = useState('queue')
  const [automix, setAutomix] = useState(() => store.settings.automix !== false)
  const toggleAutomix = () => {
    const nextVal = !automix
    setAutomix(nextVal)
    store.settings = { ...store.settings, automix: nextVal }
    applySettings(store.settings)
  }
  const [detail, setDetail] = useState(null)
  const [lyrics, setLyrics] = useState(null)
  const [showKaraoke, setShowKaraoke] = useState(false)
  const lyricBox = useRef(null)
  useEffect(() => {
    setDetail(null)
    if (panelTab === 'detail' && current && !String(current.id).startsWith('itunes:')) {
      getTrackDetail(current.id).then(setDetail).catch(() => setDetail({ error: true }))
    }
  }, [panelTab, current?.id])
  useEffect(() => {
    setLyrics(null)
    if (panelTab === 'detail' && current) getLyrics(current).then(setLyrics).catch(() => setLyrics({ error: true }))
  }, [panelTab, current?.id])
  // La letra sigue a la canción: auto-scroll a la línea activa
  const activeIdx = lyrics?.synced ? activeLine(lyrics.lines, currentTime) : -1
  useEffect(() => {
    const box = lyricBox.current
    const el = box?.querySelector('.lyric-line.active')
    if (box && el) box.scrollTo({ top: el.offsetTop - box.clientHeight / 2 + 20, behavior: 'smooth' })
  }, [activeIdx])
  const { toggleLike, isLiked, createPlaylist, addToPlaylist } = useLibrary()
  const { t } = useT()
  const [showQueue, setShowQueue] = useState(false)
  const [showVol, setShowVol] = useState(false)
  const VolIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2
  const toggleMute = () => setVolume(volume === 0 ? 0.7 : 0)
  const [coverOk, setCoverOk] = useState(true)
  useEffect(() => { setCoverOk(true) }, [current?.id])
  const liked = current ? isLiked(current.id) : false
  const progressPct = duration ? Math.min(100, (currentTime / duration) * 100) : 0
  const volPct = Math.round(volume * 100)
  const upcoming = queue.length ? [...queue.slice(index + 1), ...queue.slice(0, index)].slice(0, 6) : []
  // Cola pro: selección múltiple + arrastrar para reordenar + guardar como playlist
  const [sel, setSel] = useState(() => new Set())
  const [dragOverQi, setDragOverQi] = useState(null)
  const [savedFlash, setSavedFlash] = useState(false)
  const dragQi = useRef(null)
  useEffect(() => { setSel(new Set()); setDragOverQi(null) }, [queue])
  const toggleSel = (qi) => setSel((prev) => { const n = new Set(prev); if (n.has(qi)) n.delete(qi); else n.add(qi); return n })
  const fmtSleep = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  // Nivel del temporizador (clics deterministas: 15 → 30 → 60 → apagado)
  const [sleepStep, setSleepStep] = useState(0)
  useEffect(() => { if (!sleepLeft) setSleepStep(0) }, [sleepLeft])
  const cycleSleep = () => {
    const next = sleepStep === 0 ? 15 : sleepStep === 15 ? 30 : sleepStep === 30 ? 60 : 0
    setSleepStep(next)
    setSleep(next)
  }
  const saveQueue = () => {
    if (!current) return
    const name = t('pb.queueOf', { d: new Date().toLocaleDateString(getLang() === 'en' ? 'en' : 'es', { day: 'numeric', month: 'short' }) })
    const id = createPlaylist(name)
    const ordered = [...queue.slice(index), ...queue.slice(0, index)]
    ordered.forEach((t) => addToPlaylist(id, t))
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2500)
  }

  return (
    <footer className="playerbar">
      <div className="player-song">
        <div className="mini-cover">
          {current?.artwork && coverOk
            ? <img key={current.id} src={current.artwork} alt="" draggable={false} onError={() => setCoverOk(false)} />
            : <Music2 size={20} />}
        </div>
        <div className="song-info">
          <strong>{current ? current.title : t('pb.choose')}</strong>
          <p>{current ? `${current.artist} • ${current.genre}` : t('pb.tapAny')}{current?.preview ? ` • ${t('pb.preview')}` : ''}</p>
        </div>
        <button className={`like ${liked ? 'active' : ''}`} onClick={() => current && toggleLike(current)} aria-label={t('pb.like')}>
          <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="player-controls">
        <div className="buttons">
          <button onClick={() => setShuffle(!shuffle)} aria-label={t('pb.shuffle')} className={shuffle ? 'active' : ''} disabled={!current}>
            <Shuffle size={18} />
          </button>
          <button onClick={prev} aria-label={t('pb.prev')} disabled={!current}><SkipBack size={20} /></button>
          <button className="play" onClick={toggle} aria-label={isPlaying ? t('pb.pause') : t('pb.play')} disabled={!current}>
            {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </button>
          <button onClick={() => next(false)} aria-label={t('pb.next')} disabled={!current}><SkipForward size={20} /></button>
          <button onClick={cycleRepeat} aria-label={t('pb.repeat')} className={repeat !== 'off' ? 'active' : ''} disabled={!current} title={t('pb.repeatTip').split('|')[repeat === 'one' ? 2 : repeat === 'all' ? 1 : 0]}>
            {repeat === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}
          </button>
          <button onClick={() => setShowQueue(!showQueue)} aria-label={t('pb.queue')} className={showQueue ? 'active' : ''} disabled={!queue.length}>
            <ListMusic size={18} />
          </button>
        </div>
        <div className="progress">
          <small>{formatTime(currentTime)}</small>
          <input type="range" min={0} max={duration || 0} step={1} value={currentTime || 0}
            onChange={(e) => seek(Number(e.target.value))} className="seek styled" disabled={!current} aria-label={t('pb.progress')}
            style={{ '--p': `${progressPct}%` }} />
          <small>{formatTime(duration || current?.duration)}</small>
        </div>
        {audioError && <small className="error-inline">{audioError}</small>}
      </div>

      <div className="player-vol">
        <div className="vol-desktop">
          <button className={`like sleep-btn${sleepLeft ? ' active' : ''}`} onClick={cycleSleep} aria-label={t('pb.sleep')} title={sleepLeft ? t('pb.sleepTitle', { t: fmtSleep(sleepLeft) }) : t('pb.sleepCycle')}>
            <Timer size={18} />
            {sleepLeft > 0 && <span className="sleep-t">{fmtSleep(sleepLeft)}</span>}
          </button>
          <button className="like" onClick={toggleMute} aria-label={t('pb.mute')} title={`${t('pb.volume')} ${volPct}%`}>

            <VolIcon size={18} />
          </button>
          <input type="range" min={0} max={1} step={0.05} value={volume}
            onChange={(e) => setVolume(Number(e.target.value))} className="seek small styled vol-slider" aria-label={t('pb.volume')}
            style={{ '--p': `${volPct}%` }} />
        </div>
        <button className="like vol-mobile-btn" onClick={() => setShowVol(!showVol)} aria-label={t('pb.volume')} title={`${t('pb.volume')} ${volPct}%`}>
          <VolIcon size={18} />
        </button>
        {showVol && (
          <div className="vol-pop">
            <button className="like" onClick={toggleMute} aria-label={t('pb.mute')}>
              <VolIcon size={18} />
            </button>
            <input type="range" min={0} max={1} step={0.05} value={volume}
              onChange={(e) => setVolume(Number(e.target.value))} className="seek styled vol-slider" aria-label={t('pb.volume')}
              style={{ '--p': `${volPct}%` }} />
            <span className="vol-pct">{volPct}%</span>
          </div>
        )}
      </div>
      {showVol && <button className="vol-backdrop" onClick={() => setShowVol(false)} aria-hidden="true" tabIndex={-1} />}

      {showQueue && (
        <div className="queue-panel">
          <div className="queue-head">
            <div className="segmented small">
              <button className={panelTab === 'queue' ? 'seg active' : 'seg'} onClick={() => setPanelTab('queue')}><ListMusic size={14} /> {t('pb.queue')}</button>
              <button className={panelTab === 'detail' ? 'seg active' : 'seg'} onClick={() => setPanelTab('detail')}>{t('pb.details')}</button>
            </div>
            <button className="icon-btn" onClick={() => setShowQueue(false)} aria-label={t('pb.close')}><X size={14} /></button>
          </div>
          {panelTab === 'queue' ? (<>
            <div className="queue-actions">
              <small className="muted">{t('pb.upcoming', { n: upcoming.length })}</small>
              {upcoming.length > 0 && sel.size === 0 && (
                <button className="link-chip" onClick={() => setSel(new Set(upcoming.map((t) => queue.findIndex((x) => x.id === t.id)).filter((qi) => qi >= 0)))}>{t('pb.all')}</button>
              )}
              {sel.size > 0 && <button className="link-chip danger" onClick={() => removeMany([...sel])}>{t('pb.removeN', { n: sel.size })}</button>}
              {current && (
                <button className="link-chip" onClick={saveQueue} title={t('pb.saveQueueTitle')}>
                  <ListPlus size={12} /> {savedFlash ? t('pb.saved') : t('pb.saveQueue')}
                </button>
              )}
              {upcoming.length > 0 && <button className="link-chip" onClick={clearUpNext}>{t('pb.clear')}</button>}
              <button className={`link-chip${automix ? ' on' : ''}`} onClick={toggleAutomix} title={automix ? t('pb.radioOnTitle') : t('pb.radioOffTitle')}>
                {automix ? t('pb.radioOn') : t('pb.radioOff')}
              </button>
            </div>
            {current && (
              <div className="queue-item current-q">
                <span className="q-cover">{current.artwork ? <img src={current.artwork} alt="" /> : <Music2 size={14} />}</span>
                <span className="q-meta"><strong>{current.title}</strong><small>{t('pb.nowPlaying')}</small></span>
              </div>
            )}
            {upcoming.length === 0
              ? <p className="muted">{t('pb.emptyQueue')}</p>
              : upcoming.map((it) => {
                const qi = queue.findIndex((x) => x.id === it.id)
                return (
                  <div
                    key={it.id}
                    className={`queue-row${sel.has(qi) ? ' selected' : ''}${dragOverQi === qi ? ' drag-over' : ''}`}
                    draggable
                    onDragStart={(e) => { dragQi.current = qi; e.dataTransfer.effectAllowed = 'move' }}
                    onDragOver={(e) => { e.preventDefault(); if (dragOverQi !== qi) setDragOverQi(qi) }}
                    onDragLeave={() => { if (dragOverQi === qi) setDragOverQi(null) }}
                    onDrop={(e) => { e.preventDefault(); if (dragQi.current != null && dragQi.current !== qi) moveQueue(dragQi.current, qi); dragQi.current = null; setDragOverQi(null) }}
                    onDragEnd={() => { dragQi.current = null; setDragOverQi(null) }}
                  >
                    <span className="q-grip" title="Arrastra para reordenar"><GripVertical size={14} /></span>
                    <input type="checkbox" className="q-check" checked={sel.has(qi)} onChange={() => toggleSel(qi)} onClick={(e) => e.stopPropagation()} aria-label={t('pb.select', { t: it.title })} />
                    <button className="queue-item" onClick={() => playTrack(it, queue)}>
                      <span className="q-cover"><Music2 size={14} />{it.artwork && <img src={it.artwork} alt="" draggable={false} onError={(e) => { e.currentTarget.style.display = 'none' }} />}</span>
                      <span className="q-meta"><strong>{it.title}</strong><small>{it.artist}</small></span>
                      <small className="muted">{formatTime(it.duration)}</small>
                    </button>
                    <button className="icon-btn xs" onClick={() => removeAt(qi)} aria-label={t('pb.removeFromQ')}><X size={14} /></button>
                  </div>
                )
              })}
          </>) : (
            <div className="detail-body">
              {!current && <p className="muted">{t('pb.noDetail')}</p>}
              {current && !detail && <p className="muted">{t('pb.loadingDetail')}</p>}
              {current && detail?.error && <p className="muted">{t('pb.noDetailTrack')}</p>}
              {current && detail && !detail.error && (<>
                <p className="detail-desc">{detail.description || t('pb.noDesc')}</p>
                <div className="detail-meta">
                  {detail.bpm && <span><strong>{detail.bpm}</strong> BPM</span>}
                  {detail.key && <span>{t('pb.key')} <strong>{detail.key}</strong></span>}
                  {detail.mood && <span>{t('pb.mood')} <strong>{detail.mood}</strong></span>}
                  <span>{t('home.plays', { n: detail.plays })}</span>
                  {detail.release && <span>{t('pb.released')} <strong>{detail.release}</strong></span>}
                </div>
                {detail.tags.length > 0 && (
                  <div className="chips"><span className="muted">{t('pb.tags')}</span>{detail.tags.map((tg) => <span key={tg} className="link-chip">{tg}</span>)}</div>
                )}
                <p className="muted foot">{t('pb.viaFull')}</p>
              </>)}
              {current && detail?.error && lyrics && !lyrics.error && !lyrics.missing && lyrics.lines.length > 0 && (
                <p className="muted foot">{t('pb.viaLyrics')}</p>
              )}
              {current && lyrics && (lyrics.error
                ? <p className="muted">{t('pb.lyricsErr')}</p>
                : lyrics.missing || !lyrics.lines.length
                  ? <p className="muted">{t('pb.lyricsMissing')}</p>
                  : (
                    <div className="lyrics-box" ref={lyricBox}>
                      <p className="lyric-kicker">{lyrics.synced ? t('pb.synced') : t('pb.lyrics')}
                        <button className="link-chip" onClick={() => setShowKaraoke(true)} title={t('pb.karaokeTitle')}>
                          <Maximize2 size={12} /> {t('pb.karaoke')}
                        </button>
                      </p>
                      {lyrics.lines.map((l, i) => (
                        <p key={i} className={i === activeIdx ? 'lyric-line active' : lyrics.synced ? 'lyric-line dim' : 'lyric-line'}>{l.text || '♪'}</p>
                      ))}
                    </div>
                  ))}
            </div>
          )}
        </div>
      )}
      {showKaraoke && current && lyrics && !lyrics.error && lyrics.lines.length > 0 && createPortal(
        <Karaoke track={current} lyrics={lyrics} onClose={() => setShowKaraoke(false)} />,
        document.body
      )}
    </footer>
  )
}

export default PlayerBar
