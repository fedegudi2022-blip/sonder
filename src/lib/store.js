// Persistencia local: recuerda selecciones sin backend.
// En Etapa Supabase esto migrará a DB, misma interfaz.

// Valida el tipo del valor guardado: un dato corrupto (string donde va un
// array, número donde va un objeto…) reventaba el render y dejaba la página
// negra. Si no coincide con el fallback, se repara solo con el valor sano.
export function parseStored(raw, fallback) {
  if (!raw) return fallback
  const v = JSON.parse(raw)
  const want = Array.isArray(fallback) ? 'array' : typeof fallback
  const got = Array.isArray(v) ? 'array' : (v === null ? 'null' : typeof v)
  if (want !== got) throw new Error('bad shape')
  return v
}

function load(key, fallback) {
  try {
    const v = parseStored(localStorage.getItem(key), fallback)
    return v
  } catch {
    try { localStorage.setItem(key, JSON.stringify(fallback)) } catch {}
    return fallback
  }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

export const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v)
export const cleanId = (x) => (typeof x === 'string' || typeof x === 'number') ? x : null

// Canónicas: cualquier forma vieja/rota (falta trackIds, ids nulos, items
// sueltos…) se convierte a la forma actual sin perder lo recuperable.
// Sin esto, un dato legacy reventaba el render y dejaba la página en negro.
export function cleanPlaylist(p, i = 0) {
  if (!isObj(p)) return null
  const ids = Array.isArray(p.trackIds) ? p.trackIds : (Array.isArray(p.tracks) ? p.tracks : [])
  return {
    id: String(p.id ?? `pl-${Date.now()}-${i}`),
    name: String(p.name ?? 'Playlist'),
    trackIds: ids.map(cleanId).filter((x) => x !== null),
    created: Number(p.created) || Date.now(),
  }
}

const healed = new Set()
// Lee + sanea + autocorrige (una vez por sesión) la clave indicada.
function healedGet(key, fallback, clean) {
  const v = load(key, fallback)
  let out
  try { out = clean(v) } catch { out = fallback }
  if (!healed.has(key)) {
    healed.add(key)
    try {
      if (JSON.stringify(out) !== JSON.stringify(v)) localStorage.setItem(key, JSON.stringify(out))
    } catch {}
  }
  return out
}

export const store = {
  get volume() { return load('sonder:volume', 0.7) },
  set volume(v) { save('sonder:volume', v) },

  get likes() { return healedGet('sonder:likes', [], (v) => v.filter((x) => cleanId(x) !== null)) }, // [trackId]
  set likes(v) { save('sonder:likes', v) },

  get likedAt() { return load('sonder:likedAt', {}) }, // {trackId: timestamp}
  set likedAt(v) { save('sonder:likedAt', v) },

  get playlists() { return healedGet('sonder:playlists', [], (v) => v.map(cleanPlaylist).filter(Boolean)) }, // [{id,name,trackIds,created}]
  set playlists(v) { save('sonder:playlists', v) },

  get history() {
    return healedGet('sonder:history', [], (v) => v.filter(isObj).map((h) => ({
      id: h.id ?? null,
      title: String(h.title ?? ''),
      artist: String(h.artist ?? ''),
      genre: String(h.genre ?? 'Desconocido'),
      at: Number(h.at) || 0,
      ...(isObj(h.track) ? { track: h.track } : {}),
    }))) // [{id,title,artist,genre,at}]
  },
  set history(v) { save('sonder:history', v.slice(0, 100)) },

  get searches() { return healedGet('sonder:searches', [], (v) => v.filter((x) => typeof x === 'string' && x)) }, // [query]
  set searches(v) { save('sonder:searches', v.slice(0, 10)) },

  get lastQueue() { return healedGet('sonder:queue', [], (v) => v.filter(isObj)) },
  set lastQueue(v) { save('sonder:queue', v.slice(0, 50)) },

  get genrePrefs() { return load('sonder:genres', {}) }, // {House: 5}
  set genrePrefs(v) { save('sonder:genres', v) },

  get settings() { return { accent: 'green', density: 'comfortable', crossfade: 0, automix: true, quality: 'alta', djVoice: true, ...load('sonder:settings', {}) } },
  set settings(v) { save('sonder:settings', v) },
}

export const ACCENTS = {
  green: { name: 'Verde Sonder', acc: '#1db954', deep: 'rgba(29,185,84,0.22)' },
  blue: { name: 'Azul', acc: '#3b82f6', deep: 'rgba(59,130,246,0.22)' },
  purple: { name: 'Violeta', acc: '#a855f7', deep: 'rgba(168,85,247,0.22)' },
  orange: { name: 'Naranja', acc: '#f59e0b', deep: 'rgba(245,158,11,0.22)' },
  red: { name: 'Rojo', acc: '#ef4444', deep: 'rgba(239,68,68,0.22)' },
}

export function applySettings(s = store.settings) {
  const a = ACCENTS[s.accent] || ACCENTS.green
  document.documentElement.style.setProperty('--acc', a.acc)
  document.documentElement.style.setProperty('--acc-soft', a.deep)
  document.body.dataset.density = s.density || 'comfortable'
}

// Suma una escucha al historial y a prefs de género
export function recordPlay(track) {
  if (!track) return
  const h = store.history.filter((x) => x.id !== track.id)
  h.unshift({ id: track.id, title: track.title, artist: track.artist, genre: track.genre || 'Desconocido', at: Date.now(), track })
  store.history = h
  if (track.genre) {
    const g = store.genrePrefs
    g[track.genre] = (g[track.genre] || 0) + 1
    store.genrePrefs = g
  }
  store.lastQueue = store.lastQueue.length ? store.lastQueue : []
}

// Género favorito según escuchas
export function topGenre() {
  const g = store.genrePrefs
  let best = null, n = 0
  for (const k of Object.keys(g)) if (g[k] > n) { n = g[k]; best = k }
  return best
}
