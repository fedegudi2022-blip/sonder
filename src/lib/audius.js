// Cliente Audius - música legal y gratis, sin API key.
// Verificado Oct-2026: discoveryprovider.audius.co/v1 funciona.
// Stream devuelve 302 hacia creatornode, el <audio> lo sigue solo.

const HOST = 'https://discoveryprovider.audius.co/v1'
import { t, getLang } from './i18n.js'

const APP = 'Sonder'

// Fetch con timeout + reintentos con backoff: el discovery de Audius suele
// devolver 429/502/503 en ráfagas (visto en vivo). Los 429/5xx esperan y
// reintentan; otros 4xx se devuelven para que cada llamada decida.
async function fetchRetry(url, { timeout = 12000, retries = 2 } = {}) {
  let lastErr = new Error('fetch fallido')
  for (let i = 0; i <= retries; i++) {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), timeout)
    try {
      const res = await fetch(url, { signal: ctl.signal })
      clearTimeout(timer)
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error('HTTP ' + res.status)
        await new Promise((r) => setTimeout(r, Math.min(1200 * (i + 1), 4000) + Math.random() * 400))
        continue
      }
      return res
    } catch (e) {
      clearTimeout(timer)
      lastErr = e
      if (i < retries) await new Promise((r) => setTimeout(r, 350 * (i + 1) + Math.random() * 250))
    }
  }
  throw lastErr
}

export const GENRES = ['Electronic', 'House', 'Hip-Hop/Rap', 'Lo-Fi', 'Pop', 'R&B/Soul', 'Rock', 'Techno', 'Jazz', 'Ambient', 'Latin', 'Reggaeton', 'Trap', 'Moombahton', 'Dancehall', 'Reggae']

// Detecta versiones derivadas por título: remix, cover, sped up, slowed, flip, edit…
// Devuelve 'remix' | 'cover' | 'version' | null (null = probable original).
export function detectVersion(title) {
  const s = (title || '').toLowerCase()
  if (!s) return null
  if (/\b(remix|rmx|flip|bootleg|mashup)\b/.test(s)) return 'remix'
  if (/\b(cover|tributo|tribute|karaoke)\b/.test(s)) return 'cover'
  if (/sped\s*up|slowed|\bslowed\s*\+|reverb|8d|nightcore|instrumental|acapella|a\s*capella|edit\b|extended|vip\b/.test(s)) return 'version'
  if (/\S+\s+intro\s*$/.test(s) && s.trim().toLowerCase() !== 'intro') return 'version' // "Break Intro": edit de DJ, no el tema puro
  if (/\(\s*(remix|cover|sped|slowed|edit)/.test(s)) return 'version'
  return null
}

// Convierte un track de Audius a nuestro formato interno
export function mapTrack(t) {
  const artwork =
    t.artwork?.['480x480'] ||
    t.artwork?.['150x150'] ||
    t.artwork?.['1000x1000'] ||
    null

  const remixParents = t.remix_of?.tracks?.length || 0
  const versionKind = detectVersion(t.title || '')
  return {
    id: t.id,
    title: t.title || 'Sin título',
    artist: t.user?.name || 'Artista desconocido',
    artistId: t.user?.id || null,
    artistVerified: t.user?.is_verified === true,
    handle: t.user?.handle || '',
    isRemix: remixParents > 0 || versionKind === 'remix',
    versionKind,
    createdAt: t.created_at || null,
    genre: t.genre || 'Desconocido',
    mood: t.mood || null,
    duration: t.duration || 0,
    playCount: t.play_count || 0,
    release: (t.release_date || '').slice(0, 10),
    artwork,
    streamUrl: `${HOST}/tracks/${t.id}/stream?app_name=${APP}`,
    permalink: t.permalink ? `https://audius.co${t.permalink}` : null,
  }
}

export async function getTrending(limit = 20, genre = null, time = 'week') {
  const g = genre ? `&genre=${encodeURIComponent(genre)}` : ''
  const res = await fetchRetry(`${HOST}/tracks/trending?app_name=${APP}&limit=${limit}${g}&time=${time}`)
  // Géneros no canónicos (ej. Reggaeton) pueden fallar en trending: cae a búsqueda
  if (!res.ok && genre) return searchTracks(genre, limit, genre)
  if (!res.ok) throw new Error('No se pudo cargar trending')
  const json = await res.json()
  const tracks = (json.data || [])
    .filter((t) => t.is_streamable !== false && t.is_delete !== true)
    .map(mapTrack)
  // Audius a veces ignora el género y devuelve trending genérico: verifícalo
  if (genre) {
    const gl = genre.toLowerCase()
    const matching = tracks.filter((t) => (t.genre || '').toLowerCase().includes(gl))
    if (matching.length < 4) return searchTracks(genre, limit, genre)
  }
  return tracks
}

async function fetchSearchRaw(q, limit) {
  const res = await fetchRetry(
    `${HOST}/tracks/search?query=${encodeURIComponent(q)}&app_name=${APP}&limit=${limit}`
  )
  if (!res.ok) throw new Error('No se pudo buscar')
  const json = await res.json()
  return (json.data || [])
    .filter((t) => t.is_streamable !== false && t.is_delete !== true)
    .map(mapTrack)
}

// Normaliza para comparar: minúsculas + sin tildes ("Báilala" = "bailala")
export function norm(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// Puntaje propio: título manda, luego artista, luego popularidad.
// Corrige el orden flojo de Audius (ej. "rowsfred" traía remixes ajenos primero).
// Resubidos spam: agregadores y marcas de descarga que ensucian los resultados
// ("y2mate.com - DUKI Goteo Video Oficial" subido por un tercero).
const SPAM_TOKENS = [
  /y2mate/i, /justnaija/i, /naijaloaded/i, /tooxclusive/i,
  /video\s*oficial/i, /official\s*(music\s*)?video/i, /audio\s*oficial/i,
  /descarga(r)?\s*(aqui|aquí)?/i, /download\s*(link|here|now)?/i,
  /whatsapp/i, /spotify\s*link/i, /subscribe/i, /suscr[ií]bete/i,
]

export function spamHits(title) {
  const s = title || ''
  let n = 0
  for (const re of SPAM_TOKENS) if (re.test(s)) n++
  if (/\.com\b/.test(s)) n++ // "algo.com" en el título: casi siempre spam
  return n
}

// Huella para colapsar resubidos: mismo autor + mismo título limpio.
// Limpia marcas de spam y puntuación para que "Goteo (y2mate.com)" y
// "DUKI - Goteo Video Oficial" caigan en el mismo grupo.
function fingerprint(tr) {
  let s = norm(tr.title)
  s = s.replace(/https?:\/\/\S+/g, ' ')
  s = s.replace(/\b\w+\.com\b/g, ' ')
  s = s.replace(/y2mate|justnaija|naijaloaded|tooxclusive/g, ' ')
  s = s.replace(/video oficial|official (music )?video|audio oficial|official audio/g, ' ')
  s = s.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
  return `${norm(tr.artist)} ~ ${s}`
}

function titlePrint(tr) {
  return fingerprint(tr).split(' ~ ')[1]
}

// Colapsa resubidos: por grupo (autor + título limpio) queda el mejor rankeado.
// Segundo pase: mismo título limpio desde uploaders distintos se colapsa solo
// si hay spam de por medio (>=2 miembros spammy) — así "Freedom" de dos
// autores legítimos sobrevive, pero los 3 "DUKI Goteo Video Oficial" no.
// La lista debe venir ya ordenada por puntaje: se conserva el primero.
export function collapseReuploads(ranked) {
  const seen = new Set()
  const first = []
  for (const tr of ranked || []) {
    const fp = fingerprint(tr)
    if (seen.has(fp)) continue
    seen.add(fp)
    first.push(tr)
  }
  const byTitle = new Map()
  first.forEach((tr) => {
    const k = titlePrint(tr)
    if (!byTitle.has(k)) byTitle.set(k, [])
    byTitle.get(k).push(tr)
  })
  const out = []
  for (const group of byTitle.values()) {
    if (group.length >= 2 && group.filter((tr) => spamHits(tr.title) > 0).length >= 2) {
      out.push(group[0]) // el mejor por puntaje; el resto era spam duplicado
    } else {
      out.push(...group)
    }
  }
  return out
}

export function rankTracks(tracks, query, demote = true) {
  const nq = norm(query)
  const words = nq.split(/\s+/).filter((w) => w.length > 1)
  const wantsVersion = /remix|cover|sped|slowed|flip|karaoke|instrumental|tributo/.test(nq)
  const scored = tracks.map((tr) => {
    const nt = norm(tr.title)
    const na = norm(tr.artist)
    let s = 0
    if (nt === nq) s += 12 // título exacto
    if (na === nq) s += 10 // artista exacto
    for (const w of words) {
      if (nt.includes(w)) s += 3
      if (na.includes(w)) s += 2
      if (norm(tr.handle).includes(w)) s += 1
    }
    if (nt.startsWith(nq) || na.startsWith(nq)) s += 2
    // Autor original primero: penaliza versiones ajenas salvo que las pidas.
    // ("rowsfred" traía remixes ajenos primero; ahora el original sube.)
    if (!wantsVersion) {
      if (tr.versionKind === 'remix') s -= 4
      else if (tr.versionKind === 'cover') s -= 5
      else if (tr.versionKind === 'version') s -= 3
      else s += 1.5 // probable original: pequeño impulso
    }
    if (tr.artistVerified) s += 1
    // Anti-spam: títulos con marcas de agregadores bajan, salvo que el que
    // sube sea claramente el autor buscado (su nombre está en la query).
    // (demote=false para matchFullVersions: ahí los resubidos SON el objetivo
    // y los elige la puerta de título+duración, no el rank.)
    if (demote) {
      const artistStrong = words.length > 1 && words.every((w) => na.includes(w) || norm(tr.handle).includes(w))
      const spam = spamHits(tr.title)
      if (spam > 0 && !artistStrong) s -= Math.min(4 * spam, 10)
      // "Habla de X pero no es de X": el título nombra al artista buscado pero
      // el uploader no coincide (covers ajenos, resubidos). No aplica si buscas
      // una sola palabra o si pides versiones explícitamente.
      if (words.length >= 2 && !wantsVersion) {
        const titleAbout = words.every((w) => nt.includes(w))
        const byUploader = words.some((w) => na.includes(w) || norm(tr.handle).includes(w))
        if (titleAbout && !byUploader) s -= 6
      }
    }
    s += Math.log10((tr.playCount || 0) + 1) // desempate por popularidad
    return [s, tr]
  })
  return scored.sort((a, b) => b[0] - a[0]).map(([, tr]) => tr)
}

// Separa originales de versiones para mostrar "Originales" arriba en fichas.
export function partitionVersions(tracks) {
  const originals = []
  const versions = []
  for (const tr of tracks || []) (tr.versionKind || tr.isRemix ? versions : originals).push(tr)
  return { originals, versions }
}

export async function searchTracks(query, limit = 20, genre = null, opts = {}) {
  if (!query.trim() && !genre) return getTrending(limit)
  // Si hay género + texto, buscamos texto y filtramos por género en cliente
  // (Audius search no acepta genre directo de forma estable)
  const q = query.trim() || genre || 'music'
  // Exacto primero (Latin, Trap…); si hay poco, incluye variantes (Trap Soul, Latin Pop…)
  const filterGenre = (list) => {
    const gl = genre.toLowerCase()
    const exact = list.filter((t) => (t.genre || '').toLowerCase() === gl)
    return exact.length >= 4 ? exact : list.filter((t) => (t.genre || '').toLowerCase().includes(gl))
  }
  // Exacta + por palabra en paralelo ("Jay Wheeler" aunque falle la exacta)
  const words = [...new Set(norm(q).split(/\s+/).filter((w) => w.length > 1))].slice(0, 3)
  const queries = [q, ...words.filter((w) => norm(w) !== norm(q))].slice(0, 4)
  const lists = await Promise.all(queries.map((x) => fetchSearchRaw(x, limit).catch(() => [])))
  const seen = new Set()
  let tracks = lists.flat().filter((tr) => (seen.has(tr.id) ? false : (seen.add(tr.id), true)))
  if (genre) tracks = filterGenre(tracks)
  // rawPool (matchFullVersions): sin penalizar ni colapsar — necesita todos
  // los resubidos para elegir por título+duración.
  if (opts.rawPool) tracks = rankTracks(tracks, q, false)
  else tracks = collapseReuploads(rankTracks(tracks, q))
  return tracks.slice(0, limit)
}

export function mapArtist(u) {
  return {
    id: u.id,
    name: u.name || 'Artista desconocido',
    handle: u.handle || '',
    bio: u.bio || '',
    followers: u.follower_count || 0,
    trackCount: u.track_count || 0,
    verified: u.is_verified === true,
    artwork: u.profile_picture?.['480x480'] || u.profile_picture?.['150x150'] || u.profile_picture?.['1000x1000'] || null,
  }
}

export function mapAlbum(p) {
  return {
    id: p.id,
    name: p.playlist_name || 'Sin título',
    isAlbum: p.is_album === true,
    trackCount: p.playlist_contents?.track_ids?.length || 0,
    plays: p.total_play_count || 0,
    artwork: p.artwork?.['480x480'] || p.artwork?.['150x150'] || null,
  }
}

export async function searchArtists(query, limit = 12) {
  const q = (query || '').trim()
  if (q.length < 2) return []
  const res = await fetchRetry(`${HOST}/users/search?query=${encodeURIComponent(q)}&app_name=${APP}&limit=${limit}`)
  if (!res.ok) throw new Error('No se pudo buscar artistas')
  const json = await res.json()
  const nq = norm(q)
  const words = nq.split(/\s+/).filter((w) => w.length > 1)
  const artists = (json.data || []).map(mapArtist)
  // Rank propio: nombre exacto > todas las palabras > verificado > seguidores.
  // Evita que un homónimo con más plays tape al autor original.
  return artists
    .map((a) => {
      const na = norm(a.name)
      const nh = norm(a.handle)
      let s = 0
      if (na === nq || nh === nq) s += 20
      else if (words.length && words.every((w) => na.includes(w) || nh.includes(w))) s += 12
      else for (const w of words) { if (na.includes(w)) s += 3; else if (nh.includes(w)) s += 2 }
      if (na.startsWith(nq)) s += 3
      if (a.verified) s += 5
      s += Math.log10((a.followers || 0) + 1) + Math.log10((a.trackCount || 0) + 1)
      return [s, a]
    })
    .sort((a, b) => b[0] - a[0])
    .map(([, a]) => a)
}

export async function searchAlbums(query, limit = 12) {
  const res = await fetch(`${HOST}/playlists/search?query=${encodeURIComponent(query)}&app_name=${APP}&limit=${limit}`)
  if (!res.ok) throw new Error('No se pudo buscar álbumes')
  const json = await res.json()
  return (json.data || []).filter((p) => !p.is_private && !p.is_delete).map(mapAlbum)
}

// Artistas en tendencia: usuarios únicos de los tracks trending de la semana
export async function getTrendingArtists(limit = 12) {
  const res = await fetch(`${HOST}/tracks/trending?app_name=${APP}&limit=30&time=week`)
  if (!res.ok) throw new Error('No se pudo cargar artistas')
  const json = await res.json()
  const seen = new Set()
  const out = []
  for (const t of json.data || []) {
    if (!t.user || seen.has(t.user.id)) continue
    seen.add(t.user.id)
    out.push(mapArtist(t.user))
    if (out.length >= limit) break
  }
  return out
}

// Álbumes/playlists en tendencia de la semana
export async function getTrendingAlbums(limit = 12) {
  const res = await fetch(`${HOST}/playlists/trending?app_name=${APP}&limit=${limit}&time=week`)
  if (!res.ok) throw new Error('No se pudo cargar álbumes')
  const json = await res.json()
  return (json.data || []).filter((p) => !p.is_private && !p.is_delete).map(mapAlbum)
}

// Recupera un track por su ID (repara cachés viejas o poszczególnes faltantes)
export async function getTrackById(id) {
  const res = await fetch(`${HOST}/tracks/${id}?app_name=${APP}`)
  if (!res.ok) throw new Error('Track no encontrado')
  const json = await res.json()
  return mapTrack(json.data)
}

export async function getPlaylistTracks(playlistId, limit = 30) {
  const res = await fetch(`${HOST}/playlists/${playlistId}/tracks?app_name=${APP}&limit=${limit}`)
  if (!res.ok) throw new Error('No se pudo abrir el álbum')
  const json = await res.json()
  return (json.data || [])
    .filter((t) => t.is_streamable !== false && t.is_delete !== true)
    .map(mapTrack)
}

// Ficha completa de un autor (bio, seguidores, artwork)
export async function getUser(userId) {
  const res = await fetchRetry(`${HOST}/users/${userId}?app_name=${APP}`)
  if (!res.ok) throw new Error('No se pudo cargar el artista')
  const json = await res.json()
  return mapArtist(json.data)
}

// Álbumes y playlists públicas del autor
export async function getArtistAlbums(userId, limit = 10) {
  const res = await fetch(`${HOST}/users/${userId}/albums?app_name=${APP}&limit=${limit}`)
  if (!res.ok) return []
  const json = await res.json()
  return (json.data || []).filter((p) => !p.is_private && !p.is_delete).map(mapAlbum)
}

// Resuelve "quién es" una búsqueda: mejor candidato verificado + su top + alternativos.
// Evita homónimos exigiendo coincidencia fuerte o top con sustancia.
// Devuelve {artist, top, candidates} o null.
export async function resolveArtist(query, minTop = 2) {
  const q = (query || '').trim()
  if (q.length < 2) return null
  const nq = norm(q)
  const words = nq.split(/\s+/).filter((w) => w.length > 1)
  let artists = []
  try { artists = await searchArtists(q, 6) } catch { return null }
  if (!artists.length) return null
  const strong = (a) => {
    const na = norm(a.name)
    const nh = norm(a.handle)
    if (na === nq || nh === nq) return 3
    if (words.length && words.every((w) => na.includes(w) || nh.includes(w))) return 2
    return 0
  }
  const ranked = artists
    .map((a) => [strong(a) * 10 + (a.verified ? 6 : 0) + Math.log10((a.followers || 0) + 1) + Math.log10((a.trackCount || 0) + 1), a])
    .filter(([s]) => s > 0)
    .sort((a, b) => b[0] - a[0])
  const candidates = ranked.slice(0, 3).map(([, a]) => a)
  for (const [, a] of ranked.slice(0, 2)) {
    try {
      const top = await getArtistTopTracks(a.id, 20)
      if (top.length >= minTop) return { artist: a, top, candidates }
    } catch {}
  }
  // Sin top con sustancia: devuelve igual los candidatos para desambiguar en UI
  if (candidates.length) return { artist: candidates[0], top: [], candidates }
  return null
}

export async function getArtistTopTracks(userId, limit = 10) {
  const res = await fetchRetry(`${HOST}/users/${userId}/tracks?app_name=${APP}&limit=${limit}&sort=plays`)
  if (!res.ok) throw new Error('No se pudo cargar el artista')
  const json = await res.json()
  return (json.data || [])
    .filter((t) => t.is_streamable !== false && t.is_delete !== true)
    .map(mapTrack)
}

// Detecta Argentina por zona horaria o idioma del equipo
// (America/Argentina/* o es-AR). Sin geolocalización ni permisos.
export function detectAR() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    if (tz.startsWith('America/Argentina')) return true
  } catch {}
  try {
    if ((navigator.language || '').toLowerCase() === 'es-ar') return true
  } catch {}
  return false
}

// Música con sabor argentino: combina búsquedas típicas y quita duplicados
const AR_QUERIES = ['duki', 'cumbia', 'cuarteto']
export async function getArgentinaTracks(perQuery = 4) {
  const lists = await Promise.all(
    AR_QUERIES.map((q) => searchTracks(q, perQuery).catch(() => []))
  )
  const seen = new Set()
  return lists.flat().filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)))
}

// Habla español (toda Latinoamérica + España), sin geolocalización ni permisos
export function detectLatino() {
  if (detectAR()) return true
  try {
    if ((navigator.language || '').toLowerCase().startsWith('es')) return true
  } catch {}
  return false
}

// Puro latino: reggaetón, cumbia, trap latino, dembow… lo que haya en Audius
const LAT_QUERIES = ['reggaeton', 'cumbia villera', 'trap latino', 'dembow', 'salsa']
export async function getLatinoTracks(perQuery = 4) {
  const lists = await Promise.all(
    LAT_QUERIES.map((q) => searchTracks(q, perQuery).catch(() => []))
  )
  const seen = new Set()
  return lists.flat().filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)))
}

// Ficha completa para el panel Detalles (descripción, tags, BPM, tono)
export async function getTrackDetail(id) {
  const res = await fetch(`${HOST}/tracks/${id}?app_name=${APP}`)
  if (!res.ok) throw new Error('Sin detalles')
  const t = (await res.json()).data
  return {
    description: t.description || '',
    tags: (t.tags || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 8),
    bpm: t.bpm || null,
    key: t.musical_key || null,
    genre: t.genre || '',
    mood: t.mood || '',
    plays: t.play_count || 0,
    release: (t.release_date || '').slice(0, 10),
  }
}

// Hace cuánto se subió (created_at = subida real, no fecha editable de lanzamiento)
export function timeAgo(iso) {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  if (isNaN(ms) || ms < 0) return ''
  const plural = (key, n) => {
    const s = t(key, { n })
    return s.includes('|') ? s.split('|')[n === 1 ? 0 : 1] : s
  }
  const min = Math.floor(ms / 60000)
  if (min < 1) return t('time.now')
  if (min < 60) return t('time.min', { n: min })
  const h = Math.floor(min / 60)
  if (h < 24) return t('time.hour', { n: h })
  const d = Math.floor(h / 24)
  if (d < 7) return t('time.day', { n: d })
  const w = Math.floor(d / 7)
  if (w < 5) return t('time.week', { n: w })
  const m = Math.floor(d / 30)
  if (m < 12) return plural('time.month', m)
  return plural('time.year', Math.floor(m / 12))
}

// Novedades: junta varias fuentes, quita repetidos y ordena por subida real.
// (Audius no tiene endpoint global de "recién subido": esto lo aproxima bien)
export async function getFreshTracks(limit = 12) {
  const [week, month, g1, g2, g3] = await Promise.all([
    getTrending(30, null, 'week').catch(() => []),
    getTrending(30, null, 'month').catch(() => []),
    searchTracks('new music', 10).catch(() => []),
    searchTracks('electronic', 10).catch(() => []),
    searchTracks('2026', 10).catch(() => []),
  ])
  const seen = new Set()
  const all = [...week, ...month, ...g1, ...g2, ...g3].filter((t) => {
    if (!t || seen.has(t.id)) return false
    seen.add(t.id)
    return true
  })
  return all
    .filter((t) => t.createdAt)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit)
}

// Artistas que más suben últimamente (candidatos a "sube música a diario")
export function getActiveArtists(tracks, limit = 8, days = 45) {
  const cutoff = Date.now() - days * 86400000
  const by = new Map()
  tracks.forEach((t) => {
    if (!t.createdAt || new Date(t.createdAt).getTime() < cutoff) return
    const key = t.artistId || t.artist
    if (!by.has(key)) by.set(key, { id: t.artistId, name: t.artist, count: 0, latest: null, latestAt: 0 })
    const e = by.get(key)
    e.count++
    const at = new Date(t.createdAt).getTime()
    if (at > e.latestAt) { e.latestAt = at; e.latest = t }
  })
  return [...by.values()]
    .sort((a, b) => b.count - a.count || b.latestAt - a.latestAt)
    .slice(0, limit)
}

export function formatTime(sec) {
  if (!sec || isNaN(sec)) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
