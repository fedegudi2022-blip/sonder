import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Play, UserPlus, UserCheck, Disc3, Users, BadgeCheck } from 'lucide-react'
import { usePlayer } from '../context/PlayerContext.jsx'
import { useLibrary } from '../context/LibraryContext.jsx'
import { getUser, getArtistTopTracks, getArtistAlbums, getPlaylistTracks, partitionVersions } from '../lib/audius.js'
import { useT } from '../lib/i18n.js'
import TrackRow from './TrackRow.jsx'

// Ficha del autor original: quién es, seguir, su top y sus álbumes.
// Se abre tocando el nombre del artista en filas, tarjetas y estantes.
function ArtistView() {
  const { artistView, closeArtist, followArtist, isFollowing } = useLibrary()
  const { playTrack } = usePlayer()
  const { t } = useT()
  const [artist, setArtist] = useState(artistView?.name ? { id: artistView.id, name: artistView.name } : null)
  const [top, setTop] = useState([])
  const [albums, setAlbums] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!artistView?.id) return
    let alive = true
    setLoading(true)
    Promise.all([
      getUser(artistView.id).catch(() => null),
      getArtistTopTracks(artistView.id, 20).catch(() => []),
      getArtistAlbums(artistView.id, 10).catch(() => []),
    ]).then(([u, tracks, albs]) => {
      if (!alive) return
      if (u) setArtist(u)
      setTop(tracks); setAlbums(albs); setLoading(false)
    })
    return () => { alive = false }
  }, [artistView?.id])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') closeArtist() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeArtist])

  if (!artistView) return null
  const following = artist?.id ? isFollowing(artist.id) : false

  const openAlbum = async (al) => {
    try {
      const tracks = await getPlaylistTracks(al.id, 30)
      if (tracks.length) playTrack(tracks[0], tracks)
    } catch {}
  }

  return createPortal(
    <div className="artist-page" role="dialog" aria-label={artist?.name || t('home.sameAuthor')}>
      <div className="artist-hero">
        <button className="icon-btn artist-close" onClick={closeArtist} aria-label={t('pb.close')}><X size={18} /></button>
        <span className="artist-big-cover">
          {artist?.artwork ? <img src={artist.artwork} alt="" /> : <Disc3 size={40} />}
        </span>
        <div className="page-titles">
          <p className="hero-kicker2">{t('artist.kicker')}</p>
          <h2 className="liked-title">{artist?.name || artistView?.name || '…'}{artist?.verified && <BadgeCheck size={20} className="verified-badge" title={t('artist.verified')} />}</h2>
          <p className="muted head-count">
            {artist?.handle ? `@${artist.handle} • ` : ''}
            {(artist?.followers || 0) > 1000
              ? `${Math.round(artist.followers / 1000)}k ${t('artist.followers')}`
              : `${artist?.followers || 0} ${t('artist.followers')}`}
            {(artist?.trackCount || 0) > 0 ? ` • ${t('artist.tracks', { n: artist.trackCount })}` : ''}
          </p>
        </div>
        {top.length > 0 && (
          <button className="shuffle-fab" onClick={() => playTrack(top[0], top)} aria-label={t('home.playTopShort')}>
            <Play size={18} />
          </button>
        )}
        {artist?.id && (
          <button className={`icon-btn${following ? ' on' : ''}`} onClick={() => followArtist(artist)} title={following ? t('artist.following') : t('artist.follow')}>
            {following ? <UserCheck size={16} /> : <UserPlus size={16} />}
            {following ? t('artist.following') : t('artist.follow')}
          </button>
        )}
      </div>
      {artist?.bio ? <p className="detail-desc artist-bio">{artist.bio.slice(0, 400)}</p> : null}
      {loading && <p className="muted">{t('pb.loadingDetail')}</p>}
      {!loading && top.length > 0 && (() => {
        const { originals, versions } = partitionVersions(top)
        const main = originals.length ? originals : top
        return (<>
          <h3 className="title-row small"><Play size={16} /> {originals.length && versions.length ? t('artist.originals') : t('artist.top')}</h3>
          <div className="track-list main-list">
            {main.slice(0, 10).map((tr, i) => <TrackRow key={tr.id} track={tr} index={i} lista={main} />)}
          </div>
          {originals.length > 0 && versions.length > 0 && (<>
            <h3 className="title-row small" style={{ marginTop: '1rem' }}><Disc3 size={16} /> {t('artist.versions', { n: versions.length })}</h3>
            <div className="track-list main-list versions-list">
              {versions.slice(0, 6).map((tr, i) => <TrackRow key={tr.id} track={tr} index={i} lista={versions} />)}
            </div>
          </>)}
        </>)
      })()}
      {!loading && albums.length > 0 && (<>
        <h3 className="title-row small"><Disc3 size={16} /> {t('artist.albums', { n: albums.length })}</h3>
        <div className="grid">
          {albums.map((al) => (
            <button key={al.id} className="song-card album-card" onClick={() => openAlbum(al)}>
              <span className="song-cover has-img">
                {al.artwork ? <img src={al.artwork} alt={al.name} loading="lazy" /> : <Disc3 size={28} />}
                <span className="badge-genre">{al.isAlbum ? t('home.album') : t('home.playlist')}</span>
              </span>
              <strong>{al.name}</strong>
              <small className="muted">{t('home.themesCount', { n: al.trackCount })}</small>
            </button>
          ))}
        </div>
      </>)}
      {!loading && !top.length && <p className="muted"><Users size={14} /> {t('artist.empty')}</p>}
    </div>,
    document.body
  )
}

export default ArtistView
