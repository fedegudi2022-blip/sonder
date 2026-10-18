import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Volume2, VolumeX, Volume1, Heart, Music2 } from 'lucide-react'
import { usePlayer } from '../context/PlayerContext.jsx'
import { useLibrary } from '../context/LibraryContext.jsx'
import { formatTime } from '../lib/audius.js'
import { useT } from '../lib/i18n.js'

// Vista "Sonando ahora" a pantalla completa estilo Spotify: portada gigante,
// título, progreso arrastrable, controles, volumen y Me gusta.
// Se abre tocando la canción del reproductor inferior o el botón expandir.
function NowPlaying({ onClose }) {
  const { current, isPlaying, toggle, next, prev, volume, setVolume, currentTime, duration, seek, shuffle, setShuffle, repeat, cycleRepeat } = usePlayer()
  const { toggleLike, isLiked } = useLibrary()
  const { t } = useT()
  const [coverOk, setCoverOk] = useState(true)
  useEffect(() => { setCoverOk(true) }, [current?.id])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose])

  if (!current) return null
  const liked = isLiked(current.id)
  const progressPct = duration ? Math.min(100, (currentTime / duration) * 100) : 0
  const volPct = Math.round(volume * 100)
  const VolIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2

  return createPortal(
    <div className="nowplaying" role="dialog" aria-label={t('np.title')}>
      <button className="icon-btn np-close" onClick={onClose} aria-label={t('pb.close')}><X size={18} /></button>
      <p className="np-kicker">{t('np.title')}</p>
      <div className="np-cover">
        {current.artwork && coverOk
          ? <img src={current.artwork} alt="" onError={() => setCoverOk(false)} draggable={false} />
          : <Music2 size={64} />}
      </div>
      <div className="np-meta">
        <strong>{current.title}</strong>
        <p>{current.artist}{current.album ? ` • ${current.album}` : ''}</p>
      </div>
      <div className="np-progress">
        <small>{formatTime(currentTime)}</small>
        <input type="range" min={0} max={duration || 0} step={1} value={currentTime || 0}
          onChange={(e) => seek(Number(e.target.value))} className="seek styled" aria-label={t('pb.progress')}
          style={{ '--p': `${progressPct}%` }} />
        <small>{formatTime(duration || current.duration)}</small>
      </div>
      <div className="np-controls">
        <button className={`like${liked ? ' active' : ''}`} onClick={() => toggleLike(current)} aria-label={t('pb.like')} title={t('pb.like')}>
          <Heart size={20} fill={liked ? 'currentColor' : 'none'} />
        </button>
        <button onClick={() => setShuffle(!shuffle)} aria-label={t('pb.shuffle')} className={shuffle ? 'active' : ''}>
          <Shuffle size={20} />
        </button>
        <button onClick={prev} aria-label={t('pb.prev')}><SkipBack size={26} /></button>
        <button className="np-play" onClick={toggle} aria-label={isPlaying ? t('pb.pause') : t('pb.play')}>
          {isPlaying ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" />}
        </button>
        <button onClick={() => next(false)} aria-label={t('pb.next')}><SkipForward size={26} /></button>
        <button onClick={cycleRepeat} aria-label={t('pb.repeat')} className={repeat !== 'off' ? 'active' : ''} title={t('pb.repeatTip').split('|')[repeat === 'one' ? 2 : repeat === 'all' ? 1 : 0]}>
          {repeat === 'one' ? <Repeat1 size={20} /> : <Repeat size={20} />}
        </button>
        <span className="np-vol">
          <VolIcon size={18} />
          <input type="range" min={0} max={1} step={0.05} value={volume}
            onChange={(e) => setVolume(Number(e.target.value))} className="seek small styled" aria-label={t('pb.volume')}
            style={{ '--p': `${volPct}%` }} />
        </span>
      </div>
    </div>,
    document.body
  )
}

export default NowPlaying
