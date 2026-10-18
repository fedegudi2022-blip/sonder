// Cliente Jamendo - segundo catálogo legal y gratuito (requiere API key gratuita).
// La key se consigue gratis en https://devportal.jamendo.com/ (sin tarjeta):
// creás una app y pegás el client_id en tu .env como VITE_JAMENDO_CLIENT_ID.
// Sin key, la app sigue funcionando solo con Audius (esta fuente se saltea sola).
// Plan gratuito: hasta ~35.000 pedidos/mes para apps no comerciales.
// Por licencia hay que dar crédito: cada track trae `permalink` a su página.

const API = 'https://api.jamendo.com/v3.0/tracks/'

export function jamendoKey() {
  try {
    return (import.meta.env.VITE_JAMENDO_CLIENT_ID || '').trim()
  } catch {
    return ''
  }
}

export function hasJamendo() {
  return jamendoKey().length > 0
}

// Convierte un track de Jamendo a nuestro formato interno (igual que Audius/iTunes)
export function mapJTrack(j) {
  const tags = j.musicinfo?.tags || {}
  const genres = Array.isArray(tags.genres) ? tags.genres : []
  return {
    id: `jamendo:${j.id}`,
    title: j.name || 'Sin título',
    artist: j.artist_name || 'Artista desconocido',
    artistId: null, // Jamendo no expone ficha de artista compatible: se resuelve por nombre
    handle: '',
    genre: genres[0] ? String(genres[0]) : 'Desconocido',
    mood: null,
    duration: Number(j.duration) || 0,
    playCount: Number(j.listencount_total || j.listencount || 0) || 0,
    artwork: j.image || j.album_image || null,
    streamUrl: j.audio || null, // URL directa de stream MP3, suena en <audio>
    permalink: j.id ? `https://www.jamendo.com/track/${j.id}` : null,
    album: j.album_name || '',
    release: (j.releasedate || '').slice(0, 10),
    source: 'jamendo',
  }
}

// Búsqueda de texto en Jamendo (temas + álbumes, MP3 buena calidad, portadas 300px)
export async function searchJamendoTracks(query, limit = 20) {
  const key = jamendoKey()
  const q = (query || '').trim()
  if (!key || q.length < 2) return []
  const n = Math.max(1, Math.min(limit, 200))
  const url = `${API}?client_id=${encodeURIComponent(key)}&format=json` +
    `&search=${encodeURIComponent(q)}&limit=${n}` +
    `&audioformat=mp32&imagesize=300&type=single%20albumtrack&include=musicinfo`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Jamendo no respondió')
  const json = await res.json().catch(() => null)
  if (!json || json.headers?.status !== 'success') throw new Error('Jamendo falló')
  return (json.results || [])
    .filter((j) => j && j.audio && j.id)
    .map(mapJTrack)
}
