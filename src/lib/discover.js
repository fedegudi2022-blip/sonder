// Descubrimiento: Daily Mix, Descubrimiento Semanal, Daylist y Enhance.
// Todo sale de Audius (legal) + tu gusto local; respeta temas excluidos.

import { getTrending, searchTracks, getArtistTopTracks, GENRES } from './audius.js'
import { getOfficialTop, matchFullVersions, scoreArtistMatch } from './itunes.js'
import { topGenre } from './store.js'
import { withoutExcluded, seededShuffle, hashSeed } from './taste.js'
import { t, getLang } from './i18n.js'

function dedupe(tracks, seen = new Set()) {
  return tracks.filter((t) => {
    if (!t || seen.has(t.id)) return false
    seen.add(t.id)
    return true
  })
}

function dayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function weekKey() {
  const d = new Date()
  const onejan = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7)
  return `${d.getFullYear()}-W${week}`
}

// Momento del día → nombre, descripción y géneros (Daylist estilo Spotify)
export function dayPart(date = new Date()) {
  const h = date.getHours()
  const day = cap(date.toLocaleDateString(getLang() === 'en' ? 'en' : 'es', { weekday: 'long' }))
  if (h >= 6 && h < 11) return { key: 'manana', name: t('day.kickoff', { d: day }), desc: t('day.kickoffD'), genres: ['Pop', 'Electronic', 'Hip-Hop/Rap'] }
  if (h >= 11 && h < 15) return { key: 'mediodia', name: t('day.midday', { d: day }), desc: t('day.middayD'), genres: ['House', 'Hip-Hop/Rap', 'Pop'] }
  if (h >= 15 && h < 19) return { key: 'tarde', name: t('day.creative', { d: day }), desc: t('day.creativeD'), genres: ['Lo-Fi', 'Electronic', 'Jazz'] }
  if (h >= 19 && h < 23) return { key: 'atardecer', name: t('day.sunset', { d: day }), desc: t('day.sunsetD'), genres: ['R&B/Soul', 'Lo-Fi', 'House'] }
  return { key: 'madrugada', name: t('day.late', { d: day }), desc: t('day.lateD'), genres: ['Ambient', 'Techno', 'R&B/Soul'] }
}

function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

async function tracksForGenres(genres, per = 5) {
  const lists = await Promise.all(
    genres.slice(0, 3).map((g) => searchTracks(g, per, g).catch(() => []))
  )
  return lists.flat()
}

// Daily Mix: tu gusto de hoy (determinista por fecha)
export async function getDailyMix(likedTracks = []) {
  const fav = topGenre()
  const seed = hashSeed(`daily-${dayKey()}`)
  const seen = new Set()
  const base = fav ? await getTrending(12, fav).catch(() => []) : await getTrending(12).catch(() => [])
  let tracks = dedupe(withoutExcluded(base), seen)
  if (likedTracks.length) {
    tracks = [...tracks, ...dedupe(withoutExcluded(seededShuffle(likedTracks, seed).slice(0, 4)), seen)]
  }
  const extra = fav ? await tracksForGenres([fav], 6).catch(() => []) : []
  tracks = [...tracks, ...dedupe(withoutExcluded(extra), seen)]
  return seededShuffle(tracks, seed).slice(0, 20)
}

// Descubrimiento Semanal: explora lo que casi no escuchas (determinista por semana)
export async function getWeeklyDiscovery() {
  const seed = hashSeed(`weekly-${weekKey()}`)
  let prefs = {}
  try { prefs = JSON.parse(localStorage.getItem('sonder:genres') || '{}') } catch {}
  const cold = GENRES.filter((g) => !(prefs[g] > 0))
  const pool = [...seededShuffle(cold.length ? cold : GENRES, seed).slice(0, 3)]
  const seen = new Set()
  const found = await tracksForGenres(pool, 6).catch(() => [])
  let tracks = dedupe(withoutExcluded(found), seen)
  if (tracks.length < 10) {
    const trend = await getTrending(15, null, 'month').catch(() => [])
    tracks = [...tracks, ...dedupe(withoutExcluded(trend), seen)]
  }
  return { genres: pool, tracks: seededShuffle(tracks, seed).slice(0, 20) }
}

// Daylist: cambia según la hora + un toque de tu género top
export async function getDaylist() {
  const part = dayPart()
  const fav = topGenre()
  const genres = fav && !part.genres.includes(fav) ? [...part.genres.slice(0, 2), fav] : part.genres
  const seen = new Set()
  const found = await tracksForGenres(genres, 6).catch(() => [])
  let tracks = dedupe(withoutExcluded(found), seen)
  if (tracks.length < 8) {
    const trend = await getTrending(12).catch(() => [])
    tracks = [...tracks, ...dedupe(withoutExcluded(trend), seen)]
  }
  return { ...part, tracks: tracks.slice(0, 20) }
}

// Relacionado con tus Me gustas: grupos por autor y por género de lo que guardaste.
// Autores de Audius → su top; conocidos oficiales → versiones completas; géneros → búsqueda.
// Nunca repite lo que ya te gusta ni lo excluido.
export async function getRelatedGroups(likedTracks, maxGroups = 3) {
  if (!likedTracks?.length) return []
  const likedIds = new Set(likedTracks.map((t) => t.id))
  const clean = (list, n) => withoutExcluded(list)
    .filter((t) => t && !likedIds.has(t.id))
    .filter((t, i, a) => a.findIndex((x) => x.id === t.id) === i)
    .slice(0, n)
  const acount = new Map()
  const gcount = {}
  likedTracks.forEach((t) => {
    const key = t.artistId || `nombre:${(t.artist || '').toLowerCase()}`
    const e = acount.get(key) || { id: t.artistId || null, name: t.artist || '', count: 0, official: (t.artistId || '').startsWith('itunes:') }
    e.count++
    acount.set(key, e)
    if (t.genre) gcount[t.genre] = (gcount[t.genre] || 0) + 1
  })
  const artists = [...acount.values()]
    .filter((a) => a.name && a.name !== 'Artista desconocido')
    .sort((a, b) => b.count - a.count)
    .slice(0, 2)
  const genres = Object.entries(gcount).sort((a, b) => b[1] - a[1]).map(([g]) => g).slice(0, 1)
  const jobs = []
  artists.forEach((a) => {
    jobs.push((async () => {
      if (a.official || !a.id) {
        // Sin previews: temas oficiales resueltos a versiones completas en Audius
        const off = await getOfficialTop(a.name, 8).catch(() => [])
        const full = await matchFullVersions(off, a.name, 8).catch(() => [])
        const tracks = clean(full, 6)
        return tracks.length >= 2 ? { label: t('rel.becauseLike', { name: a.name }), tracks } : null
      }
      const found = await getArtistTopTracks(a.id, 8).catch(() => [])
      const tracks = clean(found, 6)
      return tracks.length >= 2 ? { label: t('rel.becauseLike', { name: a.name }), tracks } : null
    })())
  })
  genres.forEach((g) => {
    jobs.push((async () => {
      const found = await searchTracks(g, 12, g).catch(() => [])
      const tracks = clean(found, 6)
      return tracks.length >= 2 ? { label: t('rel.moreLike', { g: g.toLowerCase() }), tracks } : null
    })())
  })
  const out = (await Promise.all(jobs)).filter(Boolean)
  return out.slice(0, maxGroups)
}

// Radio infinita: qué sigue cuando la cola se acaba (o está por acabarse).
// Misma vibra que el tema actual: primero el mismo artista, luego el género,
// al final trending de tu gusto. Nunca repite la cola ni lo excluido.
export async function continueVibe(track, excludeIds = [], count = 8) {
  const excluded = new Set(excludeIds)
  const seen = new Set()
  const pick = (list, n) => {
    const out = []
    for (const t of withoutExcluded(list || [])) {
      if (!t || excluded.has(t.id) || seen.has(t.id)) continue
      seen.add(t.id)
      out.push(t)
      if (out.length >= n) break
    }
    return out
  }
  const artistName = track?.artist && track.artist !== 'Artista desconocido' ? track.artist : ''
  const artistWords = artistName.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  const artistP = track?.artistId && !String(track.artistId).startsWith('itunes:')
    ? getArtistTopTracks(track.artistId, 10).catch(() => [])
    : artistWords.length
      ? searchTracks(artistName, 10).catch(() => []).then((l) => l.filter((t) => scoreArtistMatch(t, artistWords) >= 2))
      : Promise.resolve([])
  const genreP = track?.genre && track.genre !== 'Desconocido'
    ? searchTracks(track.genre, 12, track.genre).catch(() => [])
    : Promise.resolve([])
  const trendP = getTrending(10, topGenre() || undefined).catch(() => [])
  const [byArtist, byGenre, trend] = await Promise.all([artistP, genreP, trendP])
  const out = [...pick(byArtist, 4), ...pick(byGenre, count), ...pick(trend, count)].slice(0, count)
  // Última red: trending global sin filtro. La radio nunca vuelve vacía
  // (salvo corte total de red); aunque la vibra se abra, la música no para.
  if (!out.length) {
    try {
      const trending = await getTrending(10)
      return pick(trending, count)
    } catch { return [] }
  }
  return out
}

// Enhance: añade recomendadas a tu playlist (mismo ADN, sin repetidas ni excluidas)
export async function enhancePlaylist(playlist, cache, count = 5) {
  const mine = (playlist.trackIds || []).map((id) => cache[id]).filter(Boolean)
  const gcount = {}
  mine.forEach((t) => { if (t.genre) gcount[t.genre] = (gcount[t.genre] || 0) + 1 })
  const top = Object.entries(gcount).sort((a, b) => b[1] - a[1]).map(([g]) => g)
  const genres = top.length ? top.slice(0, 2) : ['Electronic']
  const seen = new Set(playlist.trackIds || [])
  const found = await tracksForGenres(genres, 10).catch(() => [])
  let pool = dedupe(withoutExcluded(found), seen)
  if (pool.length < count) {
    const trend = await getTrending(15).catch(() => [])
    pool = [...pool, ...dedupe(withoutExcluded(trend), seen)]
  }
  return pool.slice(0, count)
}
