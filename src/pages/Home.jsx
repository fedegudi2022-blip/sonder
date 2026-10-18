import { useEffect, useState, useCallback } from 'react'
import { Library, Search, MoonStar, ListMusic, Loader2, Sparkles, Shuffle, Plus, Trash2, Heart, X, History, Disc3, Play, Wand2, HeartOff, Rocket, Users, BadgeCheck, Globe } from 'lucide-react'
import { parseAdvanced, hasAdvanced, applyAdvanced } from '../lib/searchx.js'
import { excludeTrack } from '../lib/taste.js'
import { enhancePlaylist, getRelatedGroups } from '../lib/discover.js'
import SongCard from '../components/SongCard.jsx'
import TrackRow from '../components/TrackRow.jsx'
import { getTrending, searchTracks, searchArtists, searchAlbums, getPlaylistTracks, getArtistTopTracks, getArgentinaTracks, getLatinoTracks, getTrendingAlbums, getTrendingArtists, getTrackById, getFreshTracks, detectAR, detectLatino, timeAgo, norm, formatTime, GENRES } from '../lib/audius.js'
import { searchJamendoTracks, hasJamendo } from '../lib/jamendo.js'
import { getOfficialTop, findOfficialArtist, scoreArtistMatch, matchFullVersions, resolveOfficialSong } from '../lib/itunes.js'
import { searchUniverse } from '../lib/musicbrainz.js'
import UniverseView from '../components/UniverseView.jsx'
import { resolveArtist } from '../lib/audius.js'
import { usePlayer } from '../context/PlayerContext.jsx'
import { useLibrary } from '../context/LibraryContext.jsx'
import { store, topGenre } from '../lib/store.js'
import { useT, isLatinoRegion } from '../lib/i18n.js'

function Home({ vista, busqueda, setBusqueda }) {
  const [canciones, setCanciones] = useState([])
  const [albumes, setAlbumes] = useState([])
  const [artists, setArtists] = useState([]) // pestaña Artistas: autores + oficial
  const [uniArtists, setUniArtists] = useState([]) // universo MusicBrainz (todos)
  const [mbArtist, setMbArtist] = useState(null) // {mbid, name} ficha universal abierta
  const [officialSong, setOfficialSong] = useState(null) // {official, match}: LA canción de él
  const [tab, setTab] = useState('canciones') // canciones | albumes
  const [arTracks, setArTracks] = useState([])
  const [isAR] = useState(() => detectAR())
  const [latTracks, setLatTracks] = useState([])
  const [isLatino] = useState(() => detectLatino())
  const [recomendadas, setRecomendadas] = useState([])
  const [genero, setGenero] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [recLabel, setRecLabel] = useState('')
  const { setQueue, playTrack } = usePlayer()
  const { t } = useT()
  const { likes, likedAt, playlists, createPlaylist, deletePlaylist, addToPlaylist, removeFromPlaylist, getTrackCache, openArtist, openPlaylist } = useLibrary()
  const [fresh, setFresh] = useState([])
  const [artistShelf, setArtistShelf] = useState(null) // {name, tracks} del autor dominante
  const [related, setRelated] = useState([]) // grupos según tus Me gustas

  const [newName, setNewName] = useState('')
  const [historyTick, setHistoryTick] = useState(0)
  const [lim, setLim] = useState(20) // "Mostrar más": 20 → 50 → 80 (tope 100)
  const [jamOn] = useState(() => hasJamendo()) // key de Jamendo presente
  useEffect(() => { setLim(20) }, [busqueda, genero, tab])
  const [fGenre, setFGenre] = useState(null) // Filtro: género (independiente del orden)
  const [fSort, setFSort] = useState('recientes') // recientes | actividad | plays | az
  const [enhancing, setEnhancing] = useState({}) // playlistId -> estado

  const cargar = useCallback(async (q, g, t = tab) => {
    setCargando(true)
    setError(null)
    try {
      if (t === 'albumes') {
        setAlbumes(q?.trim() ? await searchAlbums(q, 12) : await getTrendingAlbums(12))
      } else if (t === 'artistas') {
        const qq = q?.trim() || ''
        let list = qq ? await searchArtists(qq, 12) : await getTrendingArtists(12)
        // Conocido ausente de Audius (Duki, Bad Bunny…): tarjeta oficial primera.
        // Al tocarla se resuelve a sus versiones completas en Audius.
        try {
          const official = qq ? await findOfficialArtist(qq) : null
          if (official && !list.some((a) => norm(a.name) === norm(official.artistName))) {
            list = [{ id: 'itunes:' + official.artistName, name: official.artistName, handle: '', followers: 0, trackCount: 0, verified: false, official: true, artwork: official.artwork || null }, ...list]
          }
        } catch {}
        setArtists(list)
        // Universo: todos los autores aunque no estén en Audius (llega aparte, sin bloquear)
        if (qq.length >= 2) searchUniverse(qq, 8).then(setUniArtists).catch(() => setUniArtists([]))
        else setUniArtists([])
      } else {
        // Búsqueda avanzada: artista:X año:1990-1995 género:Y (filtros en cliente)
        const adv = parseAdvanced(q || '')
        let tracks
        if (q?.trim() && hasAdvanced(q)) {
          const text = adv.text || adv.artist || adv.genre || 'music'
          tracks = applyAdvanced(await searchTracks(text, 30), { ...adv, genre: adv.genre || g })
        } else {
          tracks = q?.trim() ? await searchTracks(q, lim, g) : await getTrending(lim, g)
          // Jamendo en paralelo (si hay key): suma su catálogo sin duplicar
          // los que ya trajo Audius (mismo título + artista).
          if (q?.trim() && jamOn) {
            try {
              const jam = await searchJamendoTracks(q, Math.min(lim, 50))
              if (jam.length) {
                const seen = new Set(tracks.map((x) => `${norm(x.title)}|${norm(x.artist)}`))
                for (const j of jam) {
                  const k = `${norm(j.title)}|${norm(j.artist)}`
                  if (!seen.has(k)) { seen.add(k); tracks.push(j) }
                }
              }
            } catch {}
          }
        }
        // Con nombre de artista (2+ palabras): lo que más coincide con el nombre va primero
        if (q?.trim() && !hasAdvanced(q)) {
          const words = q.trim().toLowerCase().split(/\s+/).filter((w) => w.length > 2)
          if (words.length >= 2) {
            tracks = [...tracks].sort((a, b) => scoreArtistMatch(b, words) - scoreArtistMatch(a, words))
          }
        }
        setCanciones(tracks)
        setQueue(tracks)
      }
    } catch {
      setError(t('home.loadError'))
    }
    setCargando(false)
  }, [setQueue, tab, lim, jamOn])

  // Sección argentina + recomendaciones + novedades (la carga inicial la hace el debounce de abajo)
  useEffect(() => {
    getFreshTracks(40).then((all) => setFresh(all.slice(0, 12))).catch(() => {})
    if (detectAR()) getArgentinaTracks(4).then(setArTracks).catch(() => {})
    if (detectLatino() || isLatinoRegion()) getLatinoTracks(4).then(setLatTracks).catch(() => {})
    const fav = topGenre()
    if (fav) {
      searchTracks(fav, 8).then((t) => { setRecomendadas(t); setRecLabel(fav) }).catch(() => {})
    } else {
      getTrending(8).then((tr) => { setRecomendadas(tr); setRecLabel(t('home.trendingWord')) }).catch(() => {})
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Búsqueda con debounce + género + pestaña + límite
  useEffect(() => {
    const t = setTimeout(() => cargar(busqueda, genero, tab), 500)
    return () => clearTimeout(t)
  }, [busqueda, genero, tab, lim, cargar])

  // Foco en el autor: 1) artista exacto en Audius, 2) artista oficial (iTunes,
  // previews de 30s) para los conocidos que no están en Audius, 3) autor dominante.
  useEffect(() => {
    if (!busqueda.trim() || tab !== 'canciones' || canciones.length < 3) { setArtistShelf(null); return }
    let alive = true
    const words = busqueda.trim().toLowerCase().split(/\s+/).filter((w) => w.length > 2)
    const resolve = async () => {
      if (words.length >= 2) {
        try {
          const artists = await searchArtists(busqueda.trim(), 5)
          const ql = busqueda.trim().toLowerCase()
          const match = artists.find((a) => a.name.toLowerCase() === ql)
            || artists.find((a) => words.every((w) => a.name.toLowerCase().includes(w)))
          if (match && alive) {
            const tracks = await getArtistTopTracks(match.id, 20).catch(() => [])
            if (alive && tracks.length >= 2) { setArtistShelf({ name: match.name, tracks, artistId: match.id, verified: match.verified, candidates: artists.filter((a) => a.id !== match.id).slice(0, 2) }); return }
          }
        } catch {}
        // Sin artista en Audius: ¿es un conocido con catálogo oficial?
        // Sin previews: cada tema oficial se resuelve a su versión COMPLETA en Audius.
        try {
          const official = await findOfficialArtist(busqueda.trim())
          if (official && alive) {
            const tracks = await getOfficialTop(official.artistName, 10).catch(() => [])
            if (alive && tracks.length >= 2) {
              const full = await matchFullVersions(tracks, official.artistName, 10).catch(() => [])
              if (alive && full.length >= 1) {
                setArtistShelf({ name: official.artistName, tracks: full, official: true, total: tracks.length, artistId: null })
                return
              }
              if (alive) { setArtistShelf(null); return }
            }
          }
        } catch {}
      }
      if (!alive) return
      const counts = new Map()
      canciones.forEach((t) => {
        if (!t.artistId) return
        const e = counts.get(t.artistId) || { id: t.artistId, name: t.artist, count: 0 }
        e.count++
        counts.set(t.artistId, e)
      })
      const top = [...counts.values()].sort((a, b) => b.count - a.count)[0]
      if (!top || top.count < 2) { if (alive) setArtistShelf(null); return }
      // Si buscaste un nombre (2+ palabras), el autor debe ser ese nombre:
      // exige cluster fuerte (>=4) o coincidencia con lo buscado, nada de homónimos
      if (words.length >= 2) {
        const an = top.name.toLowerCase()
        const isNamed = words.every((w) => an.includes(w))
        if (!isNamed && top.count < 4) { if (alive) setArtistShelf(null); return }
      }
      const tracks = await getArtistTopTracks(top.id, 20).catch(() => [])
      if (alive && tracks.length) setArtistShelf({ name: top.name, tracks, artistId: top.id })
      else if (alive) setArtistShelf(null)
    }
    resolve()
    return () => { alive = false }
  }, [canciones, busqueda, tab])

  // Tocar el autor del estante abre su ficha (oficial → resuelve su par en Audius)
  const openShelfArtist = async () => {
    if (!artistShelf) return
    if (artistShelf.artistId) { openArtist({ id: artistShelf.artistId, name: artistShelf.name }); return }
    const r = await resolveArtist(artistShelf.name).catch(() => null)
    if (r?.top?.length) openArtist(r.artist)
  }
  // La canción original: busca el tema oficial por canción y lo empareja con
  // su versión completa en Audius ("duki goteo" → Goteo de Duki). Solo con
  // nombre de 2+ palabras y únicamente si hay versión completa que suene.
  useEffect(() => {
    const q = busqueda.trim()
    if (!q || tab !== 'canciones' || q.split(/\s+/).filter((w) => w.length > 2).length < 2) { setOfficialSong(null); return }
    let alive = true
    resolveOfficialSong(q).then((r) => { if (alive) setOfficialSong(r?.match ? r : null) }).catch(() => {})
    return () => { alive = false }
  }, [busqueda, tab])

  const shelfIds = new Set([...(artistShelf?.tracks.map((t) => t.id) || []), ...(officialSong?.match ? [officialSong.match.id] : [])])
  const gridTracks = (artistShelf && busqueda.trim()) ? canciones.filter((c) => !shelfIds.has(c.id)) : canciones

  const openAlbum = async (al) => {
    setCargando(true)
    try {
      const tracks = await getPlaylistTracks(al.id, 30)
      setCanciones(tracks)
      setQueue(tracks)
      setTab('canciones')
      setBusqueda(al.name)
      if (tracks.length) playTrack(tracks[0], tracks)
    } catch { setError(t('home.openAlbumError')) }
    setCargando(false)
  }

  // Refresca recomendaciones cuando cambia tu historial
  useEffect(() => {
    const fav = topGenre()
    if (fav && fav !== recLabel) {
      searchTracks(fav, 8).then((t) => { setRecomendadas(t); setRecLabel(fav) }).catch(() => {})
    }
    setHistoryTick((x) => x + 1)
  }, [canciones.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const searches = store.searches
  const [cache, setCache] = useState(() => getTrackCache())
  const likedTracks = likes.map((id) => cache[id]).filter(Boolean)

  // Smart Filters sobre favoritas (actividad = última escucha, ánimo, género)
  const lastPlayed = {}
  store.history.forEach((h) => { if (!(h.id in lastPlayed)) lastPlayed[h.id] = h.at })
  const likedGenres = [...new Set(likedTracks.map((t) => t.genre).filter(Boolean))]
  const likedSecs = likedTracks.reduce((a, t) => a + (t.duration || 0), 0)
  const likedDur = likedSecs >= 3600
    ? `${Math.floor(likedSecs / 3600)} h ${Math.round((likedSecs % 3600) / 60)} min`
    : `${Math.max(1, Math.round(likedSecs / 60))} min`
  // Filtro (género) y orden (4 opciones) son independientes: cada opción
  // ordena la lista completa por su propio criterio con desempate por título.
  const byTitle = (a, b) => a.title.localeCompare(b.title)
  const filteredLiked = likedTracks
    .filter((t) => (!fGenre || t.genre === fGenre))
    .sort((a, b) => fSort === 'plays'
      ? ((b.playCount - a.playCount) || byTitle(a, b))
      : fSort === 'az'
        ? byTitle(a, b)
        : fSort === 'actividad'
          ? (((lastPlayed[b.id] || 0) - (lastPlayed[a.id] || 0)) || ((likedAt[b.id] || 0) - (likedAt[a.id] || 0)) || byTitle(a, b))
          : (((likedAt[b.id] || 0) - (likedAt[a.id] || 0)) || byTitle(a, b)))

  // Enhance: añade recomendadas del mismo ADN a la playlist
  const runEnhance = async (p) => {
    if (enhancing[p.id]) return
    setEnhancing((m) => ({ ...m, [p.id]: '…' }))
    try {
      const fresh = await enhancePlaylist(p, cache, 5)
      fresh.forEach((t) => addToPlaylist(p.id, t))
      setCache(getTrackCache())
      setEnhancing((m) => ({ ...m, [p.id]: `+${fresh.length}` }))
    } catch {
      setEnhancing((m) => ({ ...m, [p.id]: 'error' }))
    }
    setTimeout(() => setEnhancing((m) => { const n = { ...m }; delete n[p.id]; return n }), 3000)
  }

  // Repara IDs huérfanos (playlists/likes viejos sin caché): los trae de la API
  useEffect(() => {
    const ids = new Set()
    playlists.forEach((p) => p.trackIds.forEach((id) => ids.add(id)))
    likes.forEach((id) => ids.add(id))
    const fresh = getTrackCache()
    const missing = [...ids].filter((id) => !fresh[id]).slice(0, 30)
    if (!missing.length) { setCache(fresh); return }
    Promise.all(missing.map((id) => getTrackById(id).catch(() => null))).then((ts) => {
      const next = getTrackCache()
      ts.filter(Boolean).forEach((t) => { next[t.id] = t })
      try { localStorage.setItem('sonder:tracks', JSON.stringify(next)) } catch {}
      setCache(next)
    })
  }, [playlists, likes, getTrackCache])

  // Relacionado con tus Me gustas (género + autor); sin likes, no hay grupos
  // (va después de likedTracks para no leerlo antes de inicializar)
  useEffect(() => {
    if (!likedTracks.length || busqueda.trim()) { setRelated([]); return }
    let alive = true
    getRelatedGroups(likedTracks).then((g) => { if (alive) setRelated(g) }).catch(() => {})
    return () => { alive = false }
  }, [likedTracks.length, busqueda]) // eslint-disable-line react-hooks/exhaustive-deps

  const shuffleAll = () => {
    if (!canciones.length) return
    const arr = [...canciones]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    playTrack(arr[0], arr)
  }

  if (vista === 'biblioteca') {
    return (
      <section className="content">
        <h2 className="title-row"><Library size={22} /> {t('lib.title')}</h2>
        <p className="muted">{t('lib.sub')}</p>

        <div className="liked-hero">
          <span className="liked-cover"><Heart size={42} fill="currentColor" /></span>
          <div className="page-titles">
            <p className="hero-kicker2">{t('lib.likedPlaylist')}</p>
            <h2 className="liked-title">{t('lib.likedTitle')}</h2>
            <p className="muted head-count">{t('lib.likedCount', { n: likedTracks.length, dur: likedTracks.length > 0 ? t('lib.likedDur', { d: likedDur }) : '' })}</p>
          </div>
          {filteredLiked.length > 0 && (
            <button className="shuffle-fab" onClick={() => playTrack(filteredLiked[0], filteredLiked)} aria-label={t('lib.playLiked')} title={t('lib.play')}>
              <Play size={18} />
            </button>
          )}
        </div>

        <div className="lib-section">
          {likedTracks.length === 0
            ? <p className="muted">{t('lib.emptyLikes')}</p>
            : (<>
              <div className="filter-bar">
                <div className="chips scroll-x">
                  <button className={!fGenre ? 'chip active' : 'chip'} onClick={() => setFGenre(null)}>{t('home.all')}</button>
                  {likedGenres.map((g) => (
                    <button key={g} className={fGenre === g ? 'chip active' : 'chip'} onClick={() => setFGenre(fGenre === g ? null : g)}>{g}</button>
                  ))}
                </div>
                <select className="select" value={fSort} onChange={(e) => setFSort(e.target.value)} aria-label={t('lib.sort')}>
                  <option value="recientes">{t('lib.sortRecent')}</option>
                  <option value="actividad">{t('lib.sortActivity')}</option>
                  <option value="plays">{t('lib.sortPlays')}</option>
                  <option value="az">{t('lib.sortAZ')}</option>
                </select>
              </div>
              {filteredLiked.length === 0
                ? <p className="muted">{t('lib.noFilter')}</p>
                : <div className="track-list main-list">
                  {filteredLiked.map((c, i) => <TrackRow key={c.id} track={c} index={i} lista={filteredLiked} addedAt={likedAt[c.id] ? timeAgo(new Date(likedAt[c.id]).toISOString()) : ''} />)}
                </div>}
            </>)}
        </div>

        <div className="lib-section">
          <h3><ListMusic size={16} /> {t('lib.playlists', { n: playlists.length })}</h3>
          <div className="new-playlist">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('lib.playlistNamePh')} onKeyDown={(e) => { if (e.key === 'Enter' && newName.trim()) { createPlaylist(newName); setNewName('') } }} />
            <button onClick={() => { if (newName.trim()) { createPlaylist(newName); setNewName('') } }}><Plus size={16} /> {t('lib.create')}</button>
          </div>
          {playlists.map((p) => {
            const tracks = p.trackIds.map((id) => cache[id]).filter(Boolean)
            return (
              <div key={p.id} className="playlist-card">
                <div className="playlist-head">
                  <strong>{p.name}</strong>
                  <span className="muted">{t('home.themesCount', { n: tracks.length })}</span>
                  <button className="icon-btn" onClick={() => openPlaylist(p.id)} aria-label={t('pl.open')}><Play size={16} /> {t('pl.open')}</button>
                  <button className="icon-btn danger" onClick={() => deletePlaylist(p.id)} aria-label={t('lib.delete')}><Trash2 size={16} /></button>
                  {tracks.length > 0 && <button className="icon-btn" onClick={() => playTrack(tracks[0], tracks)} aria-label={t('lib.play')}><Shuffle size={16} /> {t('lib.touch')}</button>}
                  <button className="icon-btn" onClick={() => runEnhance(p)} disabled={!!enhancing[p.id]} title={t('lib.enhance')}><Wand2 size={16} /> {enhancing[p.id] || t('lib.enhance')}</button>
                </div>
                {tracks.length === 0
                  ? <p className="muted">{t('lib.emptyPl')}</p>
                  : <div className="grid">{tracks.map((c) => (
                    <div key={c.id} className="with-remove">
                      <SongCard cancion={c} lista={tracks} />
                      <button className="remove-btn" onClick={() => removeFromPlaylist(p.id, c.id)} aria-label={t('lib.remove')}><X size={14} /></button>
                    </div>
                  ))}</div>}
              </div>
            )
          })}
        </div>
      </section>
    )
  }

  return (
    <section className="content">
      <div className="page-head">
        <div className="page-titles">
          <h2 className="title-row">
            {busqueda ? <><Search size={22} /> “{busqueda}”</> : vista === 'buscar' ? <><Search size={22} /> {t('home.explore')}</> : <><MoonStar size={22} /> {t('home.trending')}</>}
          </h2>
          <p className="muted head-count">{recLabel && !busqueda ? t('home.soundIs', { g: recLabel }) : ''}{t('home.themes', { n: canciones.length })}</p>
        </div>
        <button className="shuffle-fab" onClick={shuffleAll} disabled={!canciones.length} aria-label={t('home.shuffle')} title={t('home.shuffle')}>
          <Shuffle size={18} />
        </button>
      </div>

      {vista === 'buscar' && !busqueda.trim() && (<>
        <p className="hint-box"><Search size={14} /> {t('home.trick')} <code>artista:duki</code> <code>año:2018-2024</code> <code>género:trap</code> — {t('home.trickCombine')}.</p>
        {!jamOn && <p className="hint-box"><Disc3 size={14} /> {t('home.jamHint')}</p>}
        <div className="explore-grid">
          {GENRES.map((g, i) => (
            <button key={g} className={`explore-tile t${i % 5} ${genero === g ? 'active' : ''}`} onClick={() => setGenero(genero === g ? null : g)}>
              <span>{g}</span>
              <small>{genero === g ? t('home.selected') : t('home.viewSongs')}</small>
            </button>
          ))}
        </div>
      </>)}

      <div className="toolbar">
        <div className="segmented" role="tablist" aria-label={t('home.resultType')}>
          <button role="tab" aria-selected={tab === 'canciones'} className={tab === 'canciones' ? 'seg active' : 'seg'} onClick={() => setTab('canciones')}><Play size={14} /> {t('home.songs')}</button>
          <button role="tab" aria-selected={tab === 'albumes'} className={tab === 'albumes' ? 'seg active' : 'seg'} onClick={() => setTab('albumes')}><Disc3 size={14} /> {t('home.albums')}</button>
          <button role="tab" aria-selected={tab === 'artistas'} className={tab === 'artistas' ? 'seg active' : 'seg'} onClick={() => setTab('artistas')}><Users size={14} /> {t('home.artists')}</button>
        </div>
        {!(vista === 'buscar' && !busqueda.trim()) && (
        <div className="chips scroll-x">
          <button className={!genero ? 'chip active' : 'chip'} onClick={() => setGenero(null)}>{t('home.all')}</button>
          {GENRES.map((g) => (
            <button key={g} className={genero === g ? 'chip active' : 'chip'} onClick={() => setGenero(genero === g ? null : g)}>{g}</button>
          ))}
        </div>
        )}
      </div>

      {searches.length > 0 && !busqueda && vista !== 'buscar' && (
        <p className="muted history-row"><History size={14} /> {searches.map((s) => (
          <button key={s} className="link-chip" onClick={() => setBusqueda(s)}>{s}</button>
        ))}</p>
      )}

      {error && tab !== 'canciones' && <p className="error">{error}</p>}
      {tab === 'albumes' && (
        <div className="grid">
          {albumes.map((al) => (
            <button key={al.id} className="song-card album-card" onClick={() => openAlbum(al)}>
              <span className="song-cover has-img">
                {al.artwork ? <img src={al.artwork} alt={al.name} loading="lazy" /> : <Disc3 size={28} />}
                <span className="badge-genre">{al.isAlbum ? t('home.album') : t('home.playlist')}</span>
              </span>
              <strong>{al.name}</strong>
              <small className="muted">{t('home.themesCount', { n: al.trackCount })} • {t('home.plays', { n: al.plays })}</small>
            </button>
          ))}
        </div>
      )}



      {tab === 'albumes' && !cargando && albumes.length === 0 && <p className="muted">{t('home.albumsEmpty')}</p>}

      {tab === 'artistas' && !cargando && artists.length === 0 && <p className="muted">{t('home.artistsEmpty')}</p>}
      {tab === 'artistas' && uniArtists.length > 0 && (
        <div className="lib-section">
          <h3><Globe size={16} /> {t('uni.universeTitle')}</h3>
          <p className="muted">{t('uni.universeSub')}</p>
          <div className="uni-list">
            {uniArtists.map((u) => (
              <button key={u.mbid} className="uni-row" onClick={() => setMbArtist(u)} title={t('uni.openProfile')}>
                <span className="q-cover"><Globe size={15} /></span>
                <span className="q-meta"><strong>{u.name}</strong><small>{[u.country, u.type, u.disambiguation].filter(Boolean).join(' • ') || t('uni.artistWord')}</small></span>
                <small className="muted">{t('uni.openProfile')} →</small>
              </button>
            ))}
          </div>
        </div>
      )}
      {mbArtist && (
        <UniverseView artist={mbArtist} onClose={() => setMbArtist(null)} onSearchRelease={(q) => { setMbArtist(null); setBusqueda(q); setTab('canciones') }} />
      )}
      {tab === 'artistas' && (
        <div className="grid">
          {artists.map((a) => (
            <button key={a.id} className="song-card artist-card" onClick={() => {
              if (a.official) { setBusqueda(a.name); setTab('canciones') }
              else openArtist({ id: a.id, name: a.name })
            }}>
              <span className="song-cover has-img">
                {a.artwork ? <img src={a.artwork} alt={a.name} loading="lazy" /> : <Users size={28} />}
                {a.official
                  ? <span className="badge-genre">{t('home.officialArtist')}</span>
                  : a.verified ? <span className="badge-genre">✓</span> : null}
              </span>
              <strong>{a.name}{a.verified && <BadgeCheck size={14} className="verified-badge" />}</strong>
              <small className="muted">
                {a.official ? t('home.tapToResolve') : `${a.handle ? `@${a.handle} • ` : ''}${a.followers >= 1000 ? `${Math.round(a.followers / 1000)}k` : (a.followers || 0)} ${t('artist.followers')}`}
              </small>
            </button>
          ))}
        </div>
      )}

      {tab === 'canciones' && (<>
      {cargando && canciones.length === 0 && (
        <div className="grid skeleton-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="song-card skeleton"><div className="song-cover shimmer" /><div className="line w80 shimmer" /><div className="line w60 shimmer" /></div>
          ))}
        </div>
      )}
      {cargando && canciones.length > 0 && <p className="muted loading"><Loader2 size={18} className="spin" /> {t('home.updating')}</p>}
      {error && <p className="error">{error}</p>}
      {!cargando && canciones.length === 0 && <p className="muted">{t('home.noResults')}</p>}

      {officialSong?.match && busqueda.trim() && (
        <div className="artist-shelf official-song">
          <div className="artist-shelf-head">
            <span className="artist-shelf-cover">
              {officialSong.official.artwork ? <img src={officialSong.official.artwork} alt="" /> : <Disc3 size={28} />}
            </span>
            <div className="page-titles">
              <p className="hero-kicker2">{t('home.officialSong')}</p>
              <h3 className="title-row small">{officialSong.official.title} — {officialSong.official.artist}</h3>
              <p className="muted head-count">{formatTime(officialSong.official.duration)} • {t('home.fullVersionBy', { name: officialSong.match.artist })}</p>
            </div>
            <button className="shuffle-fab" onClick={() => playTrack(officialSong.match, [officialSong.match])} aria-label={t('home.playTop', { name: officialSong.official.title })} title={t('home.playTopShort')}>
              <Play size={18} />
            </button>
          </div>
        </div>
      )}

      {artistShelf && busqueda.trim() && (
        <div className="artist-shelf">
          <div className="artist-shelf-head">
            <span className="artist-shelf-cover">
              {artistShelf.tracks[0]?.artwork ? <img src={artistShelf.tracks[0].artwork} alt="" /> : <Disc3 size={28} />}
            </span>
            <div className="page-titles">
              <p className="hero-kicker2">{artistShelf.official ? t('home.officialArtist') : t('home.sameAuthor')}</p>
              <button className="artist-name-btn" onClick={openShelfArtist} title={artistShelf.name}><h3 className="title-row small">{artistShelf.name}{artistShelf.verified && ' ✓'}</h3></button>
              <p className="muted head-count">{t('home.fullTracks', { n: artistShelf.tracks.length, total: artistShelf.total ? ` de ${artistShelf.total}` : '' })}{artistShelf.official ? t('home.versionsNote') : t('home.topNote')}</p>
              {artistShelf.candidates?.length > 0 && (
                <p className="muted history-row">{t('home.didYouMean')} {artistShelf.candidates.map((c) => (
                  <button key={c.id} className="link-chip" onClick={() => openArtist({ id: c.id, name: c.name })}>{c.name}</button>
                ))}</p>
              )}
            </div>
            <button className="shuffle-fab" onClick={() => playTrack(artistShelf.tracks[0], artistShelf.tracks)} aria-label={t('home.playTop', { name: artistShelf.name })} title={t('home.playTopShort')}>
              <Play size={18} />
            </button>
          </div>
          <div className="track-list">
            {artistShelf.tracks.slice(0, 10).map((t, i) => <TrackRow key={t.id} track={t} index={i} lista={artistShelf.tracks} />)}
          </div>
        </div>
      )}

      {artistShelf && busqueda.trim() && gridTracks.length > 0 && <h3 className="title-row small" style={{ marginTop: '1.2rem' }}>{t('home.moreResults')}</h3>}
      <div className="track-list main-list">
        {gridTracks.map((c, i) => <TrackRow key={c.id} track={c} index={i} lista={gridTracks} />)}
      </div>
      {busqueda.trim() && !cargando && canciones.length >= lim && lim < 100 && (
        <button className="more-btn" onClick={() => setLim((l) => Math.min(l + 30, 100))}>
          <Plus size={15} /> {t('home.showMore')}
        </button>
      )}
      </>)}

      {fresh.length > 0 && vista === 'inicio' && tab === 'canciones' && !busqueda.trim() && (
        <div className="rec-section">
          <h3 className="title-row small"><Rocket size={18} /> {t('home.fresh')}</h3>
          <p className="muted">{t('home.freshSub')}</p>
          <div className="grid">
            {fresh.map((c) => <SongCard key={c.id} cancion={c} lista={fresh} showAge />)}
          </div>
        </div>
      )}

      {(isLatino || isLatinoRegion()) && latTracks.length > 0 && (tab === 'canciones' || !busqueda.trim()) && (
        <div className="rec-section">
          <h3 className="title-row small">{t('home.latino')}</h3>
          <p className="muted">{t('home.latinoSub')}</p>
          <div className="grid">
            {latTracks.map((c) => <SongCard key={c.id} cancion={c} lista={latTracks} />)}
          </div>
        </div>
      )}

      {isAR && arTracks.length > 0 && (tab === 'canciones' || !busqueda.trim()) && (
        <div className="rec-section">
          <h3 className="title-row small">{t('home.argentina')}</h3>
          <p className="muted">{t('home.argentinaSub')}</p>
          <div className="grid">
            {arTracks.map((c) => <SongCard key={c.id} cancion={c} lista={arTracks} />)}
          </div>
        </div>
      )}

      {related.length > 0 && vista === 'inicio' && !busqueda.trim() && related.map((g) => (
        <div key={g.label} className="rec-section">
          <h3 className="title-row small"><Sparkles size={18} /> {g.label}</h3>
          <p className="muted">{t('rel.according')}</p>
          <div className="track-list">
            {g.tracks.map((c, i) => <TrackRow key={c.id} track={c} index={i} lista={g.tracks} />)}
          </div>
        </div>
      ))}

      {related.length === 0 && recomendadas.length > 0 && (
        <div className="rec-section">
          <h3 className="title-row small"><Sparkles size={18} /> {t('home.recommended')} {recLabel ? `• ${recLabel}` : ''}</h3>
          <p className="muted">{t('home.recommendedSub', { top: recLabel && recLabel !== t('home.trendingWord') ? ` ${t('home.recommendedTop', { g: recLabel })}` : '' })}</p>
          <div className="grid">
            {recomendadas.map((c) => <SongCard key={c.id} cancion={c} lista={recomendadas} />)}
          </div>
        </div>
      )}

      <p className="muted foot"><ListMusic size={14} /> {t('home.source')}</p>
    </section>
  )
}

export default Home
