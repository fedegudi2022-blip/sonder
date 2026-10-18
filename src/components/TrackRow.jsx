import { useState } from 'react'
import { Heart, Plus } from 'lucide-react'
import { usePlayer } from '../context/PlayerContext.jsx'
import { useLibrary } from '../context/LibraryContext.jsx'
import { formatTime, resolveArtist } from '../lib/audius.js'
import { excludeTrack } from '../lib/taste.js'
import { useT } from '../lib/i18n.js'

// Fila numerada estilo Spotify: # portada título/artista + playlist ♡ duración
function TrackRow({ track, index, lista, addedAt = null }) {
  const { playTrack, current, isPlaying, toggle } = usePlayer()
  const { toggleLike, isLiked, playlists, addToPlaylist, openArtist } = useLibrary()
  const [showAdd, setShowAdd] = useState(false)
  const { t } = useT()
  const esActual = current?.id === track.id
  const liked = isLiked(track.id)

  const handlePlay = () => {
    if (esActual) toggle()
    else playTrack(track, lista)
  }
  // Ir al autor original (tracks de iTunes se resuelven por nombre)
  const goArtist = async (e) => {
    e.stopPropagation()
    if (track.artistId && !String(track.artistId).startsWith('itunes:')) {
      openArtist({ id: track.artistId, name: track.artist })
      return
    }
    const r = await resolveArtist(track.artist).catch(() => null)
    if (r?.top?.length) openArtist(r.artist)
  }

  return (
    <div className={`track-row ${esActual ? 'playing' : ''}`}>
      <span className="track-num">
        {esActual && isPlaying
          ? <span className="eq"><i /><i /><i /></span>
          : index + 1}
      </span>
      <button className="track-main" onClick={handlePlay} aria-label={t('row.play', { t: track.title })}>
        <span className="track-cover">
          {track.artwork
            ? <img src={track.artwork} alt="" loading="lazy" draggable={false} onError={(e) => { e.currentTarget.style.display = 'none' }} />
            : <span className="cover-fallback sm">{(track.title || '?')[0]}</span>}
        </span>
        <span className="track-meta"><strong>{track.title}{track.explicit ? <span className="explicit-badge">E</span> : null}</strong><small><button className="artist-link" onClick={goArtist} title={track.artist}>{track.artist}</button>{track.album ? ` • ${track.album}` : ''}</small></span>
      </button>
      {track.preview && <span className="preview-badge" title={t('pb.preview')}>30s</span>}
      {track.source === 'jamendo' && <span className="source-badge" title={track.permalink || 'Jamendo'}>Jamendo</span>}
      {addedAt && <span className="track-added muted">{addedAt}</span>}
      <span className="track-dur muted">{formatTime(track.duration)}</span>
      <div className="track-actions">
        <button className="icon-btn xs ghost" onClick={() => setShowAdd(!showAdd)} aria-label={t('pb.addToPl')} title={t('pb.addToPl')}>
          <Plus size={15} />
        </button>
        <button className={`like ${liked ? 'active' : ''}`} onClick={() => toggleLike(track)} aria-label={t('pb.like')} title={liked ? t('row.likedTitle') : t('row.addLikesTitle')}>
          <Heart size={17} fill={liked ? 'currentColor' : 'none'} />
        </button>
      </div>
      {showAdd && (
        <div className="add-menu row-menu">
          {playlists.length === 0 && <span className="muted">{t('row.createFirst')}</span>}
          {playlists.map((p) => (
            <button key={p.id} onClick={() => { addToPlaylist(p.id, track); setShowAdd(false) }}>{p.name}</button>
          ))}
          <button className="danger-item" onClick={() => { excludeTrack(track); setShowAdd(false) }} title={t('row.noInfluenceTitle')}>{t('row.noInfluence')}</button>
        </div>
      )}
    </div>
  )
}

export default TrackRow
