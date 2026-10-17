import { supabase, supabaseConfigured } from './supabase.js'
import { store, parseStored, isObj, cleanId, cleanPlaylist } from './store.js'

// Sincroniza biblioteca local <-> Supabase (por usuario logueado).
// Sin sesión o sin tablas (migration.sql sin aplicar): no hace nada, modo local.

export async function pullCloud(userId) {
  if (!supabaseConfigured || !userId) return null
  try {
    const [fav, pl, fol] = await Promise.all([
      supabase.from('favorites').select('track_id,track').eq('user_id', userId),
      supabase.from('playlists').select('id,name,track_ids,tracks').eq('user_id', userId),
      supabase.from('follows').select('artist_id,artist').eq('user_id', userId),
    ])
    if (fav.error || pl.error || fol.error) return { missing: true }
    const tracks = {}
    const likes = []
    for (const r of fav.data || []) {
      likes.push(r.track_id)
      if (r.track) tracks[r.track_id] = r.track
    }
    const playlists = (pl.data || []).map((r) => ({
      id: r.id, name: r.name, trackIds: r.track_ids || [], created: Date.now(),
    }))
    for (const r of pl.data || []) Object.assign(tracks, r.tracks || {})
    const followed = (fol.data || []).map((r) => r.artist).filter(Boolean)
    return { likes, playlists, followed, tracks }
  } catch {
    return null
  }
}

// Une nube + local (unión, sin borrar nada en el pull)
export function mergeLibrary(cloud) {
  if (!cloud || cloud.missing) return cloud
  // Todo saneado: la nube puede traer formas viejas y no debe romper el render.
  const cloudLikes = Array.isArray(cloud.likes) ? cloud.likes.filter((x) => cleanId(x) !== null) : []
  const likes = [...new Set([...store.likes, ...cloudLikes])]
  const seen = new Set(store.playlists.map((p) => String(p.id)))
  const playlists = [...store.playlists]
  for (const p of (Array.isArray(cloud.playlists) ? cloud.playlists : [])) {
    const c = cleanPlaylist(p)
    if (c && !seen.has(String(c.id))) { playlists.push(c); seen.add(String(c.id)) }
  }
  let followed = []
  try {
    const v = parseStored(localStorage.getItem('sonder:followed'), [])
    followed = v.filter((a) => isObj(a) && a.id !== undefined && a.id !== null)
  } catch {}
  const fseen = new Set(followed.map((a) => a.id))
  for (const a of (Array.isArray(cloud.followed) ? cloud.followed : [])) {
    if (isObj(a) && a.id !== undefined && a.id !== null && !fseen.has(a.id)) { followed.push(a); fseen.add(a.id) }
  }
  const cache = { ...cloud.tracks }
  try { Object.assign(cache, JSON.parse(localStorage.getItem('sonder:tracks') || '{}')) } catch {}
  // Los likes que vienen de la nube sin fecha se estampan ahora (orden relativo preservado)
  const likedAt = store.likedAt || {}
  const now = Date.now()
  likes.forEach((id, i) => { if (!(id in likedAt)) likedAt[id] = now - (likes.length - i) })
  store.likes = likes
  store.likedAt = likedAt
  store.playlists = playlists
  try {
    localStorage.setItem('sonder:followed', JSON.stringify(followed))
    localStorage.setItem('sonder:tracks', JSON.stringify(cache))
  } catch {}
  return { likes, playlists, followed }
}

let pushTimer = null
// Sube el estado local (con debounce 2s para no spamear la API)
export function pushCloud(userId, { likes, playlists, followed }) {
  if (!supabaseConfigured || !userId) return
  clearTimeout(pushTimer)
  pushTimer = setTimeout(async () => {
    try {
      const cache = JSON.parse(localStorage.getItem('sonder:tracks') || '{}')
      if (likes) {
        await supabase.from('favorites').delete().eq('user_id', userId)
        const rows = likes.map((id) => ({ user_id: userId, track_id: id, track: cache[id] || {} }))
        if (rows.length) await supabase.from('favorites').upsert(rows, { onConflict: 'user_id,track_id' })
      }
      if (playlists) {
        const ids = playlists.map((p) => p.id)
        const existing = await supabase.from('playlists').select('id').eq('user_id', userId)
        const stale = (existing.data || []).map((r) => r.id).filter((id) => !ids.includes(id))
        if (stale.length) await supabase.from('playlists').delete().eq('user_id', userId).in('id', stale)
        for (const p of playlists) {
          const tracks = {}
          p.trackIds.forEach((id) => { if (cache[id]) tracks[id] = cache[id] })
          await supabase.from('playlists').upsert({
            user_id: userId, id: p.id, name: p.name, track_ids: p.trackIds, tracks,
          }, { onConflict: 'user_id,id' })
        }
      }
      if (followed) {
        await supabase.from('follows').delete().eq('user_id', userId)
        const rows = followed.map((a) => ({ user_id: userId, artist_id: a.id, artist: a }))
        if (rows.length) await supabase.from('follows').insert(rows)
      }
    } catch { /* offline o sin tablas: queda local */ }
  }, 2000)
}
