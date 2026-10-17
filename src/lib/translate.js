// Traducción al español vía MyMemory (gratis, sin clave, con CORS abierto).
// Límites anónimos modestos: traducimos por bloques y cacheamos todo en
// localStorage para no repetir nunca una traducción.

const LS_KEY = 'sonder:translations'
const memCache = new Map()

function loadLS() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch { return {} }
}
function saveLS(obj) {
  try {
    const keys = Object.keys(obj)
    while (keys.length > 300) delete obj[keys.shift()] // tope: 300 canciones
    localStorage.setItem(LS_KEY, JSON.stringify(obj))
  } catch {}
}

// Heurística rápida: ¿la letra ya está en español? (acentos, ¿¡, palabras típicas)
const ES_HINT = /[áéíóúñü¿¡]|(\b(el|la|los|las|una|que|para|como|estoy|quiero|amor|corazón|noche|vida|mami|dale|perreo|baila)\b)/i
export function looksSpanish(text) {
  return ES_HINT.test(text || '')
}

async function translateChunk(text, from = 'en') {
  const qs = new URLSearchParams({ q: text, langpair: `${from}|es` }).toString()
  const res = await fetch(`https://api.mymemory.translated.net/get?${qs}`)
  if (res.status === 429) throw new Error('Límite de traducción (intenta en un rato)')
  if (!res.ok) throw new Error('No se pudo traducir')
  const j = await res.json()
  const out = j?.responseData?.translatedText
  if (!out) throw new Error('Traducción vacía')
  return out
}

// Traduce las líneas (respeta la misma cantidad y orden). Devuelve null si no hizo falta.
export async function translateLines(lines, trackKey) {
  const texts = (lines || []).map((l) => l.text).filter(Boolean)
  if (!texts.length || looksSpanish(texts.slice(0, 12).join('\n'))) return null // ya en español
  if (memCache.has(trackKey)) return memCache.get(trackKey)
  const ls = loadLS()
  if (ls[trackKey]) { memCache.set(trackKey, ls[trackKey]); return ls[trackKey] }
  // Bloques de ~400 caracteres para no chocar con el tope por petición
  const chunks = []
  let cur = []
  let len = 0
  for (const t of texts) {
    cur.push(t); len += t.length + 1
    if (len > 400) { chunks.push(cur); cur = []; len = 0 }
  }
  if (cur.length) chunks.push(cur)
  const out = []
  for (const c of chunks) {
    const joined = c.join('\n')
    const tr = await translateChunk(joined)
    out.push(...tr.split('\n'))
  }
  // Si el servicio devolvió otra cantidad de líneas, no mezclamos idiomas
  if (out.length !== texts.length) throw new Error('Traducción desalineada')
  memCache.set(trackKey, out)
  ls[trackKey] = out
  saveLS(ls)
  return out
}
