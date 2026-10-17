// AI DJ: voz con Web Speech API (gratis, sin claves) + contexto de tu gusto.
// Habla corto entre temas cuando el modo DJ está activo.

import { t, tList, getLang } from './i18n.js'

export function voiceSupported() {
  try { return 'speechSynthesis' in window } catch { return false }
}

// Elige la voz más amable en tu idioma (femeninas suelen sonar mejor)
function pickVoice() {
  let voices = []
  try { voices = window.speechSynthesis.getVoices() || [] } catch { return null }
  const prefix = getLang() === 'en' ? 'en' : 'es'
  const mine = voices.filter((v) => (v.lang || '').toLowerCase().startsWith(prefix))
  if (!mine.length) return null
  const friendly = /(sabina|lucia|lucía|paulina|carmen|elena|sofia|sofía|valentina|google|natural|samantha|zira|aria|jenny)/i
  return mine.find((v) => friendly.test(v.name)) || mine.find((v) => v.localService) || mine[0]
}

// Habla UNA vez (el DJ ya no interrumpe entre temas)
export function speak(text) {
  if (!voiceSupported() || !text) return false
  try {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = getLang() === 'en' ? 'en-US' : 'es-ES'
    u.rate = 0.95
    u.pitch = 1.15
    u.volume = 1
    const v = pickVoice()
    if (v) { u.voice = v; u.lang = v.lang }
    window.speechSynthesis.speak(u)
    return true
  } catch { return false }
}

export function stopSpeak() {
  try { window.speechSynthesis?.cancel() } catch {}
}

// Frase corta del DJ para el tema que empieza a sonar
export function djLine(track, reason) {
  if (!track) return ''
  const openers = tList('dj.openers')
  const raw = openers[(track.title.length + track.artist.length) % openers.length]
  const pick = raw.replace('{title}', track.title).replace('{artist}', track.artist)
  return reason ? `${pick} ${reason}` : pick
}

// Motivo según tu gusto (una frase, sin enrollarse)
export function djReason(track, topGenreName) {
  if (!track) return ''
  if (topGenreName && track.genre === topGenreName) {
    return t('dj.topGenre', { g: topGenreName })
  }
  if (track.genre && track.genre !== 'Desconocido' && track.genre !== 'Unknown') {
    return t('dj.genre', { g: track.genre })
  }
  if (track.playCount > 50000) return t('dj.hot')
  return t('dj.fresh')
}
