// iTunes Search API: catálogo oficial (mainstream) con vistas previas de 30s.
// Gratis, sin clave, con CORS abierto. Los temas oficiales casi nunca están
// en Audius (indie): esto cubre a los artistas conocidos con previews legales.

const API = 'https://itunes.apple.com/search'

// Convierte un resultado de iTunes a nuestro formato interno
export function mapITrack(r) {
  return {
    id: `itunes:${r.trackId}`,
    title: r.trackName || 'Sin título',
    artist: r.artistName || 'Artista desconocido',
    artistId: r.artistId ? `itunes:artist:${r.artistId}` : null,
    handle: '',
    genre: r.primaryGenreName || 'Desconocido',
    mood: null,
    duration: Math.round((r.trackTimeMillis || 0) / 1000),
    playCount: 0,
    artwork: (r.artworkUrl100 || '').replace('100x100bb', '300x300bb') || null,
    streamUrl: r.previewUrl || null,
    permalink: r.trackViewUrl || null,
    album: r.collectionName || '',
    explicit: r.trackExplicitness === 'explicit',
    release: (r.releaseDate || '').slice(0, 10),
    createdAt: r.releaseDate || null,
    source: 'itunes',
    preview: true,
  }
}

async function searchItunes(params) {
  const qs = new URLSearchParams({ ...params, country: 'US' }).toString()
  const res = await fetch(`${API}?${qs}`)
  if (!res.ok) throw new Error('iTunes no respondió')
  const json = await res.json()
  return json.results || []
}

// Top canciones oficiales de un artista (por nombre)
export async function getOfficialTop(artistName, limit = 10) {
  const results = await searchItunes({ term: artistName, media: 'music', entity: 'song', limit: 25, attribute: 'artistTerm' })
  const ql = artistName.trim().toLowerCase()
  const words = ql.split(/\s+/).filter((w) => w.length > 2)
  const mine = results.filter((r) => {
    const an = (r.artistName || '').toLowerCase()
    return an === ql || words.every((w) => an.includes(w)) || an.includes(ql)
  })
  const pool = mine.length >= 2 ? mine : results
  const seen = new Set()
  return pool
    .filter((r) => r.previewUrl && r.trackId && !seen.has(r.trackId) && seen.add(r.trackId))
    .slice(0, limit)
    .map(mapITrack)
}

// ¿Hay un artista oficial con ese nombre? (para el panel "Del mismo autor")
export async function findOfficialArtist(name) {
  const results = await searchItunes({ term: name, media: 'music', entity: 'musicArtist', limit: 5, attribute: 'artistTerm' })
  const ql = name.trim().toLowerCase()
  const words = ql.split(/\s+/).filter((w) => w.length > 2)
  return results.find((r) => (r.artistName || '').toLowerCase() === ql)
    || results.find((r) => words.every((w) => (r.artistName || '').toLowerCase().includes(w)))
    || null
}

import { searchTracks } from './audius.js'

// Normaliza títulos para comparar (quita feat, remix, paréntesis, puntuación)
function normTitle(s) {
  return (s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // sin tildes: perdón = perdon
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\b(feat|ft|with|con|remix|remaster|version|versi\u00f3n|original|radio|edit|slowed|sped|cover|single|del|de|la|el|los|las)\b\.?/g, ' ')
    .replace(/[^a-z0-9\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1\u00fc\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ¿El título candidato corresponde al oficial? (tolera remixes/covers con otro nombre)
function titleScore(cand, off) {
  const c = normTitle(cand), o = normTitle(off)
  if (!c || !o) return 0
  if (c === o) return 5
  const cw = c.split(' ').filter((w) => w.length > 2)
  const ow = o.split(' ').filter((w) => w.length > 2)
  if (!ow.length) {
    // Título ultracorto (ej. "X"): vale si aparece como palabra suelta en un título corto
    const short = o.split(' ').filter(Boolean)
    const cwords = c.split(' ').filter(Boolean)
    return short.length && cwords.length <= 4 && short.every((w) => cwords.includes(w)) ? 3 : 0
  }
  if (c.includes(o) || o.includes(c)) return 4
  const shared = ow.filter((w) => cw.includes(w)).length
  return shared >= Math.max(2, Math.ceil(ow.length / 2)) ? 3 : 0
}

const fullCache = new Map()

// Cada tema oficial → su versión COMPLETA en Audius (remix, cover o subida de
// un fan). Mismo orden que el catálogo oficial, sin ningún preview de 30s.
export async function matchFullVersions(officialTracks, artistName, limit = 10) {
  const words = (artistName || '').toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  const jobs = (officialTracks || []).slice(0, limit).map(async (off) => {
    if (fullCache.has(off.id)) return fullCache.get(off.id)
    const score = (cands) => {
      let best = null, bestScore = -1
      for (const c of cands) {
        if (String(c.id).startsWith('itunes:')) continue
        const a = scoreArtistMatch(c, words)
        const t = titleScore(c.title, off.title)
        const durClose = off.duration && c.duration && Math.abs(c.duration - off.duration) <= 12
        // Precisión primero: exige vínculo con el artista, o título casi idéntico
        // con duración clavada (covers sin acreditar). Sin eso entra cualquier homónimo.
      const ok = (t >= 3 && a >= 1) || (t >= 4 && durClose)
      if (!ok) continue
      // La duración manda de forma gradual: el rip del audio real clava los
      // segundos oficiales (Δ0→+3, Δ30→0). Las versiones pierden contra el puro.
      const durBonus = off.duration && c.duration
        ? Math.max(0, 3 - Math.abs(c.duration - off.duration) / 10)
        : 0
      const s = t * 2 + a + durBonus + (c.versionKind ? -2 : 0)
        if (s > bestScore) { bestScore = s; best = c }
      }
      return best
    }
    // Artista primero ("Duki Goteo"): así lo escribe la gente y así afloran
    // los resubidos del audio real. Audius ordena distinto según el orden.
    const q = `${artistName || ''} ${normTitle(off.title)}`.trim()
    let cands = []
    // rawPool: trae los resubidos sin penalizar ni colapsar; la puerta de
    // título+duración elige (los rips del audio real clavan la duración).
    try { cands = await searchTracks(q, 10, null, { rawPool: true }) } catch { cands = [] }
    let best = score(cands)
    // Sin match: segundo orden (título + artista) y luego solo título.
    // La puerta de artista+duración filtra los falsos positivos.
    if (!best) {
      const q2 = `${normTitle(off.title)} ${artistName || ''}`.trim()
      try { cands = await searchTracks(q2, 12, null, { rawPool: true }) } catch { cands = [] }
      best = score(cands)
    }
    if (!best && !cands.length) {
      const tq = normTitle(off.title)
      if (tq) { try { cands = await searchTracks(tq, 12, null, { rawPool: true }) } catch { cands = [] } }
      best = score(cands)
    }
    fullCache.set(off.id, best)
    return best
  })
  return (await Promise.all(jobs)).filter(Boolean)
}

// Resuelve "la canción de él": busca el tema OFICIAL por canción (no por
// artista) y lo empareja con su versión COMPLETA en Audius por título +
// duración. Para "duki goteo" → Goteo de Duki + el rip que dura lo mismo
// (los resubidos del audio real clavan la duración oficial).
// Devuelve {official, match} o null (match null = sin versión completa).
export async function resolveOfficialSong(query) {
  const q = (query || '').trim()
  if (q.length < 4) return null
  let results = []
  try {
    results = await searchItunes({ term: q, media: 'music', entity: 'song', attribute: 'songTerm', limit: 10 })
  } catch { return null }
  if (!results.length) return null
  const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  if (words.length < 2) return null // una palabra: muy ambiguo para adivinar el tema
  const scored = results
    .filter((r) => r.previewUrl && r.trackId)
    .map((r) => {
      const an = (r.artistName || '').toLowerCase()
      const tn = (r.trackName || '').toLowerCase()
      // El artista manda (+4): evita exploits tipo "Goteo Desde el 5 Escalón
      // Duki" de NeriSound, que rellenan el título con el nombre famoso.
      let s = 0, ah = 0, th = 0
      for (const w of words) {
        if (an.includes(w)) { s += 4; ah++ }
        if (tn.includes(w)) { s += 2; th++ }
      }
      return [s, ah, th, r]
    })
    .filter(([s, ah, th]) => s >= 6 && ah >= 1 && th >= 1)
    .sort((a, b) => b[0] - a[0])
  if (!scored.length) return null
  const official = mapITrack(scored[0][3])
  const full = await matchFullVersions([official], official.artist, 1).catch(() => [])
  return { official, match: full[0] || null }
}

// Puntaje de coincidencia artista↔búsqueda (para ordenar resultados de Audius)
export function scoreArtistMatch(track, words) {
  if (!words.length) return 0
  // Palabras sueltas (no subcadenas): evita que "jam" matchee "JamieM"
  const bag = (s) => (s || '').toLowerCase().split(/[^a-z0-9\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1\u00fc]+/).filter(Boolean)
  const hit = (ws, w) => ws.some((x) => x === w || (x.startsWith(w) && x.length <= w.length + 2))
  const anWords = bag(`${track.artist || ''} ${track.handle || ''}`)
  const titleWords = bag(track.title)
  let s = 0
  words.forEach((w) => { if (hit(anWords, w)) s += 2 })
  words.forEach((w) => { if (hit(titleWords, w)) s += 1 })
  return s
}
