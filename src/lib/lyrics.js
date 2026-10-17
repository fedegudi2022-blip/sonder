// Letras sincronizadas vía LRCLIB (gratis, sin clave, con CORS abierto).
// Devuelve líneas con tiempo para resaltar al ritmo de la canción.

const cache = new Map()

// Caché persistente: la letra ya resuelta no vuelve a la red (LRCLIB tiene
// cuota y huecos). Tope 60 temas para no inflar localStorage.
const LS_LYRICS = 'sonder:lyrics'
function lsGet(key) {
  try {
    const all = JSON.parse(localStorage.getItem(LS_LYRICS) || '{}')
    const v = all[key]
    return v && Array.isArray(v.lines) ? v : null
  } catch { return null }
}
function lsSet(key, val) {
  try {
    const all = JSON.parse(localStorage.getItem(LS_LYRICS) || '{}')
    all[key] = val
    const keys = Object.keys(all)
    while (keys.length > 60) delete all[keys.shift()]
    localStorage.setItem(LS_LYRICS, JSON.stringify(all))
  } catch {}
}

// Parsea formato LRC: [mm:ss.xx] texto (puede traer varias marcas por línea)
export function parseLRC(lrc) {
  const out = []
  for (const raw of (lrc || '').split('\n')) {
    const times = [...raw.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)]
    const text = raw.replace(/\[.*?\]/g, '').trim()
    if (!times.length) continue
    for (const m of times) {
      const t = parseInt(m[1], 10) * 60 + parseFloat(m[2])
      if (text) out.push({ t, text })
    }
  }
  return out.sort((a, b) => a.t - b.t)
}

async function fetchOne(params) {
  const qs = new URLSearchParams(params).toString()
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 10000)
  try {
    const res = await fetch(`https://lrclib.net/api/get?${qs}`, { signal: ctl.signal })
    if (res.status === 404) return null
    if (!res.ok) throw new Error('LRCLIB no respondió')
    return res.json()
  } finally { clearTimeout(timer) }
}

// Búsqueda libre: para covers/subs de temas conocidos (el artista de Audius no es
// el original). Devuelve líneas sincronizadas o planas del mejor candidato.
function scoreTitle(name, words) {
  const n = (name || '').toLowerCase()
  let s = 0
  for (const w of words) if (n.includes(w)) s++
  return s
}
async function searchFallback(track) {
  const cleanTitle = (track.title || '')
    .replace(/\(.*?\)|\[.*?\]/g, '')
    .replace(/official\s*(audio|video|lyric(s)?)?|lyrics?|audio|hq|hd|^\d+\s*[-.]?\s*/gi, '')
    .replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
  const queries = [`${cleanTitle} ${track.artist || ''}`.trim(), cleanTitle]
  const words = cleanTitle.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  for (const q of queries) {
    if (q.length < 3) continue
    try {
      const r = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`)
      if (!r.ok) continue
      const list = await r.json()
      const cands = (Array.isArray(list) ? list : [])
        .filter((x) => !x.instrumental && (x.syncedLyrics || x.plainLyrics))
      if (!cands.length) continue
      cands.sort((a, b) => scoreTitle(b.trackName, words) - scoreTitle(a.trackName, words))
      if (scoreTitle(cands[0].trackName, words) === 0) continue
      const best = cands.find((x) => x.syncedLyrics) || cands[0]
      const lines = parseLRC(best.syncedLyrics || '')
      if (lines.length) return { lines, synced: true }
      const plains = (best.plainLyrics || '').split('\n').map((text) => ({ t: -1, text: text.trim() })).filter((l) => l.text)
      if (plains.length) return { lines: plains, synced: false }
    } catch {}
  }
  return null
}

export async function getLyrics(track) {
  if (!track) return { lines: [], synced: false }
  const key = `${track.artist} — ${track.title}`.toLowerCase()
  if (cache.has(key)) return cache.get(key)
  const stored = lsGet(key)
  if (stored) { cache.set(key, stored); return stored }
  const toLines = (j) => parseLRC(j?.syncedLyrics || '')
  const toPlain = (j) => (j?.plainLyrics || '').split('\n').map((text) => ({ t: -1, text: text.trim() })).filter((l) => l.text)
  try {
    // 1) Búsqueda precisa (con álbum y duración cuando existen)
    const precise = { artist_name: track.artist, track_name: track.title }
    if (track.album) precise.album_name = track.album
    if (track.duration) precise.duration = Math.round(track.duration)
    let j = await fetchOne(precise)
    let lines = toLines(j)
    // 2) Sin sincronizada: reintento amplio (suele traer la versión con tiempos)
    if (!lines.length) {
      j = await fetchOne({ artist_name: track.artist, track_name: track.title }).catch(() => j)
      lines = toLines(j)
    }
    // 3) Covers y subs (artista de Audius ≠ original): búsqueda libre por título
    if (!lines.length) {
      const fb = await searchFallback(track)
      if (fb) { cache.set(key, fb); lsSet(key, fb); return fb }
    }
    const result = lines.length
      ? { lines, synced: true }
      : ((plains => plains.length ? { lines: plains, synced: false } : { lines: [], synced: false, missing: true })(toPlain(j)))
    cache.set(key, result); lsSet(key, result)
    return result
  } catch {
    return { lines: [], synced: false, error: true }
  }
}

// Índice de la línea que corresponde al segundo actual
export function activeLine(lines, seconds) {
  let idx = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].t <= seconds) idx = i
    else break
  }
  return idx
}
