import { useState } from 'react'
import { Play, Pause } from 'lucide-react'
import { usePlayer } from '../context/PlayerContext.jsx'
import { useLibrary } from '../context/LibraryContext.jsx'
import { formatTime, timeAgo, resolveArtist } from '../lib/audius.js'
import { useT } from '../lib/i18n.js'

function SongCard({ cancion, lista, showAge = false }) {
  const { playTrack, current, isPlaying, toggle } = usePlayer()
  const { isLiked, openArtist } = useLibrary()
  const { t } = useT()
  const [imgOk, setImgOk] = useState(true)
  const esActual = current?.id === cancion.id
  const liked = isLiked(cancion.id)

  const handleClick = () => {
    if (esActual) toggle()
    else playTrack(cancion, lista)
  }

  return (
    <div className={`song-card ${esActual ? 'playing' : ''}`} onClick={handleClick} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') handleClick() }}>
      <div className="song-cover has-img">
        {cancion.artwork && imgOk ? (
          <img src={cancion.artwork} alt={cancion.title} loading="lazy" draggable={false} onError={() => setImgOk(false)} />
        ) : (
          <div className="cover-fallback">{(cancion.title || '?')[0]}</div>
        )}
        <span className="cover-gradient" />
        <span className="badge-genre">{cancion.genre}</span>
        <span className="badge-time">{formatTime(cancion.duration)}</span>
        <span className="play-hover">
          {esActual && isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
        </span>
        {esActual && <span className="eq"><i /><i /><i /></span>}
        {liked && !esActual && <span className="liked-dot" title={t('home.inFav')} />}
      </div>
      <h3>{cancion.title}</h3>
      <p><button className="artist-link" onClick={(e) => {
        e.stopPropagation()
        if (cancion.artistId && !String(cancion.artistId).startsWith('itunes:')) openArtist({ id: cancion.artistId, name: cancion.artist })
        else resolveArtist(cancion.artist).catch(() => null).then((r) => { if (r?.top?.length) openArtist(r.artist) })
      }} title={cancion.artist}>{cancion.artist}</button></p>
      <small>{showAge && timeAgo(cancion.createdAt) ? `${timeAgo(cancion.createdAt)} • ` : ''}{t('home.plays', { n: cancion.playCount > 1000 ? `${Math.round(cancion.playCount / 1000)}k` : cancion.playCount })}</small>
    </div>
  )
}

export default SongCard
