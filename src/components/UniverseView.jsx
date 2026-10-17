import { useEffect, useState } from 'react'
import { X, Globe, Disc3, Play, Loader2, BookOpen, ExternalLink } from 'lucide-react'
import { getUniverseArtist, getUniverseReleases, getWikiBio, coverArtUrl } from '../lib/musicbrainz.js'
import { useT } from '../lib/i18n.js'

// Ficha universal de un artista: existe para TODOS (MusicBrainz + Wikipedia),
// aunque no tenga audio en Audius. Los discos enlazan a la resolución de
// versiones completas que ya hace la pestaña Canciones.
function UniverseView({ artist, onClose, onSearchRelease }) {
  const { t, lang } = useT()
  const [info, setInfo] = useState(null)
  const [releases, setReleases] = useState([])
  const [wiki, setWiki] = useState(null)
  const [loading, setLoading] = useState(true)
  const [bioOpen, setBioOpen] = useState(false)

  useEffect(() => {
    if (!artist?.mbid) return
    let alive = true
    setLoading(true)
    setInfo(null); setReleases([]); setWiki(null); setBioOpen(false)
    ;(async () => {
      try {
        const [detail, rels] = await Promise.all([
          getUniverseArtist(artist.mbid).catch(() => null),
          getUniverseReleases(artist.mbid, 24).catch(() => []),
        ])
        if (!alive) return
        const full = detail || { mbid: artist.mbid, name: artist.name, tags: [], urls: {} }
        setInfo(full)
        setReleases(rels)
        // La bio/foto no bloquea la ficha: llega cuando Wikipedia responde
        getWikiBio(full.urls?.wikipedia, full.name).then((w) => { if (alive && w) setWiki(w) }).catch(() => {})
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [artist?.mbid]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!artist) return null
  const name = info?.name || artist.name
  const kindLabel = (k) => k === 'Album' ? t('uni.album') : k === 'Single' ? t('uni.single') : k === 'EP' ? 'EP' : k
  const links = info?.urls || {}

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal artist-modal" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn modal-close" onClick={onClose} aria-label={t('pb.close')}><X size={16} /></button>
        {loading && !info && <p className="muted loading"><Loader2 size={18} className="spin" /> {t('uni.loading')}</p>}
        {info && (<>
          <div className="uni-head">
            <span className="uni-photo">
              {wiki?.photo
                ? <img src={wiki.photo} alt={name} onError={(e) => { e.currentTarget.style.display = 'none' }} />
                : <Globe size={32} />}
            </span>
            <div className="page-titles">
              <p className="hero-kicker2">{t('uni.universeBadge')}</p>
              <h2 className="liked-title">{name}</h2>
              <p className="muted head-count">
                {[info.country, info.type, info.disambiguation].filter(Boolean).join(' • ') || t('uni.artistWord')}
                {info.tags?.length > 0 && ` • ${info.tags.join(', ')}`}
              </p>
              <div className="uni-actions">
                <button className="shuffle-fab" onClick={() => onSearchRelease(name)} title={t('uni.hearTop')}>
                  <Play size={18} /> {t('uni.hearTop')}
                </button>
              </div>
            </div>
          </div>

          {(wiki?.bio || links.wikipedia || links.youtube || links.spotify || links.official) && (
            <div className="uni-bio">
              {wiki?.bio && (
                <p className={`muted${bioOpen ? '' : ' clamp'}`}>{wiki.bio}</p>
              )}
              <div className="chips">
                {wiki?.bio && wiki.bio.length > 220 && (
                  <button className="link-chip" onClick={() => setBioOpen(!bioOpen)}>
                    <BookOpen size={12} /> {bioOpen ? t('uni.less') : t('uni.more')}
                  </button>
                )}
                {links.wikipedia && <a className="link-chip" href={links.wikipedia} target="_blank" rel="noreferrer">Wikipedia <ExternalLink size={11} /></a>}
                {links.youtube && <a className="link-chip" href={links.youtube} target="_blank" rel="noreferrer">YouTube <ExternalLink size={11} /></a>}
                {links.spotify && <a className="link-chip" href={links.spotify} target="_blank" rel="noreferrer">Spotify <ExternalLink size={11} /></a>}
                {links.official && <a className="link-chip" href={links.official} target="_blank" rel="noreferrer">{t('uni.officialSite')} <ExternalLink size={11} /></a>}
              </div>
            </div>
          )}

          <h3 className="title-row small">{t('uni.discography', { n: releases.length })}</h3>
          <p className="muted">{t('uni.discNote')}</p>
          {releases.length === 0 && !loading && <p className="muted">{t('uni.noReleases')}</p>}
          <div className="grid">
            {releases.map((r) => (
              <button key={r.id} className="song-card album-card" onClick={() => onSearchRelease(`${name} ${r.title}`)} title={t('uni.findVersions')}>
                <span className="song-cover has-img">
                  <Disc3 size={28} />
                  <img src={coverArtUrl(r.id)} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                  <span className="badge-genre">{kindLabel(r.kind)}</span>
                </span>
                <strong>{r.title}</strong>
                <small className="muted">{r.year || '—'}</small>
              </button>
            ))}
          </div>
          <p className="muted foot">{lang === 'es' ? 'Datos: MusicBrainz + Wikipedia · Fotos: Wikipedia · Portadas: Cover Art Archive' : 'Data: MusicBrainz + Wikipedia · Photos: Wikipedia · Covers: Cover Art Archive'}</p>
        </>)}
      </div>
    </div>
  )
}

export default UniverseView
