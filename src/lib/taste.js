// Taste Profile: tu gusto en este equipo + temas excluidos de recomendaciones.
// Las exclusiones restan peso al género para que no influyan en mixes ni DJ.

import { store, parseStored } from './store.js'

function load(key, fallback) {
  try {
    return parseStored(localStorage.getItem(key), fallback)
  } catch { return fallback }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

export function getExcluded() {
  return load('sonder:excluded', []) // [{id,title,artist,genre}]
}

export function isExcluded(id) {
  return getExcluded().some((x) => x.id === id)
}

export function excludeTrack(track) {
  if (!track || isExcluded(track.id)) return
  const list = getExcluded()
  list.unshift({ id: track.id, title: track.title, artist: track.artist, genre: track.genre || null })
  save('sonder:excluded', list.slice(0, 100))
  // Resta una escucha al género para que no pese en recomendaciones
  if (track.genre) {
    const g = store.genrePrefs
    g[track.genre] = Math.max(0, (g[track.genre] || 0) - 2)
    store.genrePrefs = g
  }
}

export function unexclude(id) {
  save('sonder:excluded', getExcluded().filter((x) => x.id !== id))
}

export function withoutExcluded(tracks) {
  const ids = new Set(getExcluded().map((x) => x.id))
  if (!ids.size) return tracks
  return tracks.filter((t) => !ids.has(t.id))
}

// Ánimos por género (+ el mood que trae Audius cuando existe)
export const MOODS = ['Energía', 'Fiesta', 'Tranqui', 'Noche', 'Concentración', 'Mañanas']

const GENRE_MOOD = {
  'House': ['Fiesta', 'Energía'],
  'Techno': ['Noche', 'Energía'],
  'Tech House': ['Fiesta', 'Energía'],
  'Hip-Hop/Rap': ['Energía', 'Noche'],
  'Trap': ['Noche', 'Energía'],
  'Latin': ['Fiesta', 'Energía'],
  'Reggaeton': ['Fiesta', 'Energía'],
  'Moombahton': ['Fiesta', 'Energía'],
  'Dancehall': ['Fiesta', 'Noche'],
  'Reggae': ['Tranqui', 'Mañanas'],
  'Lo-Fi': ['Concentración', 'Tranqui'],
  'Ambient': ['Tranqui', 'Concentración'],
  'R&B/Soul': ['Noche', 'Tranqui'],
  'Pop': ['Fiesta', 'Mañanas'],
  'Rock': ['Energía', 'Fiesta'],
  'Jazz': ['Tranqui', 'Noche'],
  'Electronic': ['Energía', 'Fiesta'],
  'Dance': ['Fiesta', 'Energía'],
  'Reggae': ['Tranqui', 'Mañanas'],
  'Folk': ['Tranqui', 'Mañanas'],
  'Classical': ['Concentración', 'Tranqui'],
  'Metal': ['Energía'],
  'Punk': ['Energía'],
  'Country': ['Mañanas', 'Tranqui'],
  'Latin': ['Fiesta', 'Energía'],
}

export function moodsOf(track) {
  const out = []
  if (track?.mood) out.push(track.mood)
  const gm = GENRE_MOOD[track?.genre] || []
  gm.forEach((m) => { if (!out.includes(m)) out.push(m) })
  if (!out.length) out.push('Tranqui')
  return out
}

export function primaryMood(track) {
  return moodsOf(track)[0]
}

// Aleatorio con semilla: el mismo día da el mismo mix
export function hashSeed(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function seededShuffle(arr, seed) {
  const a = [...arr]
  let s = seed || 1
  for (let i = a.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    const j = s % (i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Resumen del gusto para la pantalla de Taste Profile
export function tasteSummary() {
  const prefs = store.genrePrefs || {}
  const genres = Object.entries(prefs)
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
  const total = Object.values(prefs).reduce((a, n) => a + n, 0)
  return { genres, total, excluded: getExcluded() }
}
