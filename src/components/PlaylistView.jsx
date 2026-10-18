import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Play, Shuffle, Trash2, Pencil, Check, ListMusic } from 'lucide-react'
import { usePlayer } from '../context/PlayerContext.jsx'
import { useLibrary } from '../context/LibraryContext.jsx'
import { useT } from '../lib/i18n.js'
import TrackRow from './TrackRow.jsx'

// Página dedicada de playlist estilo Spotify: se abre tocando una playlist
// en el menú lateral o con "Abrir" en Biblioteca. Portada mosaico con las
// carátulas, renombrar en el lugar, play, aleatorio, borrar y lista completa.
function PlaylistView() {
  const { playlistView, closePlaylist, playlists, deletePlaylist, renamePlaylist, removeFromPlaylist, getTrackCache } = useLibrary()
  const { playTrack } = usePlayer()
  const { t } = useT()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')

  const pl = playlists.find((p) => p.id === playlistView) || null
  const tracks = useMemo(() => {
    if (!pl) return []
    const cache = getTrackCache()
    return pl.trackIds.map((id) => cache[id]).filter(Boolean)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pl])

  useEffect(() => { setEditing(false); if (pl) setName(pl.name) }, [playlistView, pl?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') closePlaylist() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closePlaylist])

  if (!playlistView) return null

  const covers = tracks.map((x) => x.artwork).filter(Boolean).slice(0, 4)
  const totalSecs = tracks.reduce((a, x) => a + (Number(x.duration) || 0), 0)
  const totalDur = totalSecs >= 3600
    ? `${Math.floor(totalSecs / 3600)} h ${Math.round((totalSecs % 3600) / 60)} min`
    : `${Math.max(1, Math.round(totalSecs / 60))} min`

  const shufflePlay = () => {
    if (!tracks.length) return
    const arr = [...tracks]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    playTrack(arr[0], arr)
  }

  const commitName = () => {
    if (pl && name.trim()) renamePlaylist(pl.id, name)
    else if (pl) setName(pl.name)
    setEditing(false)
  }

  const remove = () => {
    if (!pl) return
    deletePlaylist(pl.id)
    closePlaylist()
  }

  return createPortal(
    <div className="artist-page pl-page" role="dialog" aria-label={pl?.name || t('pl.kicker')}>
      <div className="artist-hero">
        <button className="icon-btn artist-close" onClick={closePlaylist} aria-label={t('pb.close')}><X size={18} /></button>
        <span className="pl-mosaic" style={covers.length > 1 ? undefined : { gridTemplateColumns: '1fr' }}>
          {covers.length
            ? covers.map((src, i) => <img key={i} src={src} alt="" loading="lazy" draggable={false} />)
            : <span className="pl-fallback"><ListMusic size={40} /></span>}
        </span>
        <div className="page-titles">
          <p className="hero-kicker2">{t('pl.kicker')}</p>
          {editing ? (
            <span className="pl-rename">
              <input
                value={name}
                autoFocus
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') commitName() }}
                onBlur={commitName}
                placeholder={t('pl.namePh')}
                aria-label={t('pl.rename')}
              />
              <button className="icon-btn" onClick={commitName} aria-label={t('pl.save')}><Check size={16} /></button>
            </span>
          ) : (
            <h2 className="liked-title">
              {pl?.name || '…'}
              {pl && (
                <button className="icon-btn xs ghost pl-edit" onClick={() => setEditing(true)} aria-label={t('pl.rename')} title={t('pl.rename')}>
                  <Pencil size={14} />
                </button>
              )}
            </h2>
          )}
          <p className="muted head-count">{t('pl.stats', { n: tracks.length, dur: tracks.length ? t('pl.statsDur', { d: totalDur }) : '' })}</p>
        </div>
        {tracks.length > 0 && (
          <button className="shuffle-fab" onClick={() => playTrack(tracks[0], tracks)} aria-label={t('lib.play')} title={t('lib.play')}>
            <Play size={18} />
          </button>
        )}
        {tracks.length > 1 && (
          <button className="icon-btn" onClick={shufflePlay} aria-label={t('home.shuffle')} title={t('home.shuffle')}>
            <Shuffle size={16} />
          </button>
        )}
        {pl && (
          <button className="icon-btn danger" onClick={remove} aria-label={t('lib.delete')} title={t('lib.delete')}>
            <Trash2 size={16} />
          </button>
        )}
      </div>
      {!pl || tracks.length === 0
        ? <p className="muted pl-empty">{t('pl.empty')}</p>
        : (
          <div className="track-list main-list">
            {tracks.map((c, i) => (
              <div key={c.id} className="pl-row">
                <TrackRow track={c} index={i} lista={tracks} />
                <button className="icon-btn xs ghost danger" onClick={() => removeFromPlaylist(pl.id, c.id)} aria-label={t('lib.remove')} title={t('lib.remove')}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
    </div>,
    document.body
  )
}

export default PlaylistView
