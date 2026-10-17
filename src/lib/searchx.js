// Búsqueda avanzada: sintaxis artista:X año:1990-1995 género:Y
// Ej: "duki artista:duki año:2018-2024 género:trap"
// Acepta alias: artist:, ano:, year:, genre:, genero:

export function parseAdvanced(raw) {
  const q = (raw || '').trim()
  const out = { text: q, artist: null, genre: null, yearFrom: null, yearTo: null }
  if (!q) return out

  const grab = (re) => {
    const m = q.match(re)
    return m ? m[1].trim() : null
  }
  // Valor con comillas o hasta el próximo filtro / fin
  const val = (names) => {
    const pat = new RegExp(`(?:${names})\\s*:\\s*(?:"([^"]+)"|([^\\s]+(?:\\s+(?![a-záéíóúñ]+\\s*:)[^\\s]+)*))`, 'i')
    const m = q.match(pat)
    if (!m) return null
    return (m[1] || m[2] || '').trim() || null
  }

  out.artist = val('artista|artist')
  out.genre = val('g[eé]nero|genre')
  const yearRaw = grab(/a[nñ]o\s*:\s*(\d{4}(?:\s*-\s*\d{4})?)/i) || grab(/year\s*:\s*(\d{4}(?:\s*-\s*\d{4})?)/i)
  if (yearRaw) {
    const parts = yearRaw.split('-').map((s) => parseInt(s.trim(), 10)).filter(Boolean)
    if (parts.length === 1) { out.yearFrom = parts[0]; out.yearTo = parts[0] }
    if (parts.length >= 2) { out.yearFrom = Math.min(parts[0], parts[1]); out.yearTo = Math.max(parts[0], parts[1]) }
  }

  // Quita los filtros del texto libre
  let text = q
    .replace(/(?:artista|artist)\s*:\s*("[^"]+"|[^\s]+(?:\s+(?![a-záéíóúñ]+\s*:)[^\s]+)*)/gi, ' ')
    .replace(/(?:g[eé]nero|genre)\s*:\s*("[^"]+"|[^\s]+)/gi, ' ')
    .replace(/(?:a[nñ]o|year)\s*:\s*\d{4}(?:\s*-\s*\d{4})?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  out.text = text
  return out
}

export function hasAdvanced(raw) {
  return /(?:artista|artist|g[eé]nero|genre|a[nñ]o|year)\s*:/i.test(raw || '')
}

// Filtra en cliente: artista por nombre, género por coincidencia, año por release
export function applyAdvanced(tracks, f) {
  let out = tracks || []
  if (f.artist) {
    const a = f.artist.toLowerCase()
    out = out.filter((t) => `${t.artist} ${t.handle || ''}`.toLowerCase().includes(a))
  }
  if (f.genre) {
    const g = f.genre.toLowerCase()
    out = out.filter((t) => (t.genre || '').toLowerCase().includes(g))
  }
  if (f.yearFrom) {
    out = out.filter((t) => {
      const y = parseInt((t.release || '').slice(0, 4), 10)
      if (!y) return false
      if (f.yearTo) return y >= f.yearFrom && y <= f.yearTo
      return y === f.yearFrom
    })
  }
  return out
}
