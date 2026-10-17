// MusicBrainz: el universo de artistas (quiénes existen, discografías).
// Enciclopedia abierta y gratuita, sin key. Solo metadatos: el audio lo
// resuelve Sonder por debajo (Audius → oficial → preview).
// Cortesía obligada: máximo 1 petición/segundo (cola con throttle) + reintento.

const MB = 'https://musicbrainz.org/ws/2'
const APP_CONTACT = 'SonderMusic/0.1.0 (educational app)'

let lastCall = 0
async function mbFetch(url, { retries = 2 } = {}) {
  // Throttle: espera lo que falte para respetar 1 req/s
  const wait0 = 1100 - (Date.now() - lastCall)
  if (wait0 > 0) await new Promise((r) => setTimeout(r, wait0))
  let lastErr = new Error('MusicBrainz no respondió')
  for (let i = 0; i <= retries; i++) {
    lastCall = Date.now()
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), 12000)
    try {
      const res = await fetch(url, { signal: ctl.signal, headers: { 'Accept': 'application/json' } })
      clearTimeout(timer)
      if (res.status === 503 || res.status === 429 || res.status >= 500) {
        lastErr = new Error('HTTP ' + res.status)
        await new Promise((r) => setTimeout(r, 1500 * (i + 1)))
        continue
      }
      if (!res.ok) throw new Error('HTTP ' + res.status)
      return await res.json()
    } catch (e) {
      clearTimeout(timer)
      lastErr = e
      if (i < retries) await new Promise((r) => setTimeout(r, 500 * (i + 1)))
    }
  }
  throw lastErr
}

// Normaliza para comparar (misma idea que en audius.js, sin importarlo)
function norm(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function mapMBArtist(a) {
  return {
    mbid: a.id,
    name: a.name || 'Desconocido',
    disambiguation: a.disambiguation || '',
    country: a.country || a['begin-area']?.name || '',
    type: a.type || '',
    tags: (a.tags || []).slice(0, 3).map((t) => t.name),
  }
}

// Busca artistas en el universo (todos, no solo los de Audius).
// Rankea: nombre exacto > todas las palabras > score propio de MB.
export async function searchUniverse(query, limit = 8) {
  const q = (query || '').trim()
  if (q.length < 2) return []
  const json = await mbFetch(`${MB}/artist/?query=${encodeURIComponent(q)}&fmt=json&limit=${limit}`)
  const nq = norm(q)
  const words = nq.split(/\s+/).filter((w) => w.length > 1)
  return ((json || {}).artists || [])
    .map(mapMBArtist)
    .map((a) => {
      const na = norm(a.name)
      let s = 0
      if (na === nq) s += 20
      else if (words.length && words.every((w) => na.includes(w))) s += 12
      else for (const w of words) if (na.includes(w)) s += 3
      return [s, a]
    })
    .sort((a, b) => b[0] - a[0])
    .map(([, a]) => a)
}

// Ficha: datos + enlaces (wikipedia, youtube, spotify, oficial…)
export async function getUniverseArtist(mbid) {
  const a = await mbFetch(`${MB}/artist/${mbid}?fmt=json&inc=url-rels+tags+genres+aliases`)
  const info = mapMBArtist(a)
  info.bioArea = a['begin-area']?.name || a.area?.name || ''
  info.begin = a['life-span']?.begin || ''
  info.aliases = (a.aliases || []).slice(0, 5).map((x) => x.name)
  const urls = {}
  for (const rel of a.relations || []) {
    const url = rel.url?.resource || ''
    if (!url) continue
    const type = (rel.type || '').toLowerCase()
    if (url.includes('wikipedia.org') && !urls.wikipedia) urls.wikipedia = url
    else if (url.includes('wikidata.org') && !urls.wikidata) urls.wikidata = url
    else if (url.includes('youtube.com') && !urls.youtube) urls.youtube = url
    else if (url.includes('open.spotify.com') && !urls.spotify) urls.spotify = url
    else if (type.includes('official') && !urls.official) urls.official = url
  }
  info.urls = urls
  return info
}

// Discografía: grupos de lanzamiento (álbumes, sencillos, EPs), nuevos primero.
export async function getUniverseReleases(mbid, limit = 24) {
  const json = await mbFetch(`${MB}/release-group/?artist=${mbid}&fmt=json&limit=30`)
  const list = ((json || {})['release-groups'] || [])
    .map((r) => ({
      id: r.id,
      title: r.title || 'Sin título',
      kind: r['primary-type'] || '',
      secondary: r['secondary-types'] || [],
      date: (r['first-release-date'] || '').slice(0, 10),
      year: (r['first-release-date'] || '').slice(0, 4),
    }))
    .filter((r) => ['Album', 'Single', 'EP'].includes(r.kind))
  list.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  return list.slice(0, limit)
}

// Portada vía Cover Art Archive (puede no existir → null, el <img> usa fallback).
export function coverArtUrl(releaseGroupId, size = 250) {
  if (!releaseGroupId) return null
  return `https://coverartarchive.org/release-group/${releaseGroupId}/front-${size}`
}

// Foto + bio desde Wikipedia (idioma del enlace de MB, o español, o inglés).
export async function getWikiBio(wikipediaUrl, name) {
  const fromUrl = (url) => {
    const m = (url || '').match(/https?:\/\/([a-z-]+)\.wikipedia\.org\/wiki\/(.+)/)
    return m ? { lang: m[1], title: decodeURIComponent(m[2]) } : null
  }
  const tries = []
  const direct = fromUrl(wikipediaUrl)
  if (direct) tries.push(direct)
  if (name) {
    tries.push({ lang: 'es', search: name })
    tries.push({ lang: 'en', search: name })
  }
  for (const t of tries) {
    try {
      let title = t.title
      if (!title && t.search) {
        const s = await (await fetch(`https://${t.lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(t.search)}&srlimit=1&format=json&origin=*`)).json()
        title = s?.query?.search?.[0]?.title
        if (!title) continue
      }
      const sum = await (await fetch(`https://${t.lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`)).json()
      if (sum?.extract) {
        return {
          bio: sum.extract,
          photo: sum.thumbnail?.source?.replace(/\/\d+px-/, '/480px-') || sum.originalimage?.source || null,
          url: sum.content_urls?.desktop?.page || wikipediaUrl || null,
          lang: t.lang,
        }
      }
    } catch {}
  }
  return null
}

export { APP_CONTACT }
