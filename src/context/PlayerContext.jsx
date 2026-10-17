import { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react'
import { store, recordPlay } from '../lib/store.js'
import { continueVibe } from '../lib/discover.js'
import { t } from '../lib/i18n.js'
import { withoutExcluded } from '../lib/taste.js'
import { stopSpeak } from '../lib/dj.js'

const PlayerContext = createContext(null)

// Reproductor con doble deck: crossfade real entre dos <audio>,
// automix (cola infinita) y modo AI DJ con voz.
export function PlayerProvider({ children }) {
  const audioRef = useRef(null) // deck A
  const deckBRef = useRef(null) // deck B
  const ctxRef = useRef(null)
  const gainARef = useRef(null)
  const gainBRef = useRef(null)
  const graphOk = useRef(false)
  const activeRef = useRef('A')
  const navToken = useRef(0)
  const xfadeTimer = useRef(null)
  const xfadeActive = useRef(false)
  const xfadeSched = useRef(null) // trackId con crossfade ya programado
  const objA = useRef(null)
  const objB = useRef(null)

  const [queue, setQueue] = useState(() => store.lastQueue)
  const [index, setIndex] = useState(-1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolumeState] = useState(() => store.volume)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState('off') // off | all | one
  const [audioError, setAudioError] = useState(null)
  const [dj, setDj] = useState(false)

  const current = index >= 0 ? queue[index] : null
  const queueRef = useRef(queue)
  const indexRef = useRef(index)
  queueRef.current = queue
  indexRef.current = index
  const activeAudio = () => (activeRef.current === 'A' ? audioRef.current : deckBRef.current)
  const idleAudio = () => (activeRef.current === 'A' ? deckBRef.current : audioRef.current)
  const activeGain = () => (activeRef.current === 'A' ? gainARef.current : gainBRef.current)
  const idleGain = () => (activeRef.current === 'A' ? gainBRef.current : gainARef.current)
  const targetGain = (v) => Math.pow(v, 1.6) * 0.9

  const setVolume = useCallback((v) => {
    const c = Math.min(1, Math.max(0, v))
    setVolumeState(c)
    store.volume = c
  }, [])

  // Reemplazar la cola (ej. al buscar o borrar la búsqueda) sin cambiar
  // lo que suena: si el tema actual no está en la lista nueva, se inserta
  // en su posición para que la UI nunca muestre otro tema del que suena.
  const setQueuePersist = useCallback((q) => {
    const ci = indexRef.current
    const cur = ci >= 0 ? queueRef.current[ci] : null
    let next = q
    if (cur && !q.some((t) => t.id === cur.id)) {
      next = [...q]
      next.splice(Math.min(Math.max(ci, 0), next.length), 0, cur)
    }
    setQueue(next)
    store.lastQueue = next
  }, [])

  const ensureGraph = useCallback(() => {
    if (graphOk.current) return true
    const a = audioRef.current
    const b = deckBRef.current
    if (!a || !b) return false
    try {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return false
      const ctx = new AC()
      ctxRef.current = ctx
      const comp = ctx.createDynamicsCompressor()
      comp.threshold.value = -18
      comp.knee.value = 20
      comp.ratio.value = 4
      comp.attack.value = 0.003
      comp.release.value = 0.25
      comp.connect(ctx.destination)
      const mk = (audio) => {
        audio.crossOrigin = 'anonymous'
        audio.volume = 1
        const src = ctx.createMediaElementSource(audio)
        const g = ctx.createGain()
        g.gain.value = 0
        src.connect(g)
        g.connect(comp)
        return g
      }
      gainARef.current = mk(a)
      gainBRef.current = mk(b)
      graphOk.current = true
      return true
    } catch {
      graphOk.current = false
      return false
    }
  }, [])

  const resumeCtx = useCallback(() => {
    if (ctxRef.current?.state === 'suspended') ctxRef.current.resume().catch(() => {})
  }, [])

  // Volumen maestro (respeta un crossfade en curso)
  useEffect(() => {
    if (xfadeActive.current) return
    const t = targetGain(volume)
    const ctx = ctxRef.current
    const ga = gainARef.current
    const gb = gainBRef.current
    if (graphOk.current && ctx && ga && gb) {
      const act = activeRef.current === 'A' ? ga : gb
      const idl = activeRef.current === 'A' ? gb : ga
      act.gain.setTargetAtTime(t, ctx.currentTime, 0.05)
      idl.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05)
    } else {
      if (audioRef.current) audioRef.current.volume = Math.min(1, volume)
      if (deckBRef.current) deckBRef.current.volume = Math.min(1, volume)
    }
  }, [volume])

  const forgetObj = (which) => {
    const ref = which === 'A' ? objA : objB
    if (ref.current) { try { URL.revokeObjectURL(ref.current) } catch {} ref.current = null }
  }

  // URL de streaming directa (siempre online)
  const resolveUrl = async (track) => ({ url: track.streamUrl, off: false })

  // Arranca el índice ni de la lista q (con crossfade si toca)
  const goTo = useCallback(async (q, ni) => {
    const track = q[ni]
    if (!track) return
    ensureGraph()
    resumeCtx()
    const myToken = ++navToken.current
    setAudioError(null)
    xfadeSched.current = null
    if (xfadeTimer.current) { clearTimeout(xfadeTimer.current); xfadeTimer.current = null }

    const { url } = await resolveUrl(track)
    if (myToken !== navToken.current) return

    const secs = Number(store.settings.crossfade || 0)
    const act = activeAudio()
    const wasPlaying = !!(act && act.src && !act.paused && act.currentTime > 0.2)
    const ctx = ctxRef.current
    // El mismo tema nunca hace crossfade consigo mismo (corte directo: evita
    // dos decks sonando lo mismo por doble-click o cambio rápido de mix)
    const ci0 = indexRef.current
    const curId = ci0 >= 0 && queueRef.current[ci0] ? queueRef.current[ci0].id : null
    const sameTrack = curId != null && curId === track.id

    if (secs > 0 && wasPlaying && !sameTrack && graphOk.current && ctx && url) {
      // --- Crossfade: el deck libre entra con fundido ---
      const idle = idleAudio()
      const gIdle = idleGain()
      const gAct = activeGain()
      const idleDeck = activeRef.current === 'A' ? 'B' : 'A'
      forgetObj(idleDeck)
      idle.src = url
      idle.currentTime = 0
      xfadeActive.current = true
      gIdle.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05)
      try { await idle.play() } catch { /* sigue en hard */ }
      if (myToken !== navToken.current) { idle.pause(); xfadeActive.current = false; return }
      const t = targetGain(store.volume)
      gIdle.gain.setTargetAtTime(t, ctx.currentTime, Math.max(0.3, secs / 3))
      gAct.gain.setTargetAtTime(0.0001, ctx.currentTime, Math.max(0.3, secs / 3))
      const oldDeck = activeRef.current
      activeRef.current = idleDeck
      setIndex(ni)
      recordPlay(track)
      setIsPlaying(true)
      setCurrentTime(0)
      xfadeTimer.current = setTimeout(() => {
        const oldAudio = oldDeck === 'A' ? audioRef.current : deckBRef.current
        try { oldAudio?.pause() } catch {}
        xfadeActive.current = false
      }, secs * 1000 + 400)
      return
    }

    // --- Cambio directo (comportamiento clásico) ---
    try { deckBRef.current?.pause() } catch {}
    try { audioRef.current?.pause() } catch {}
    // Limpia el deck libre: sin src viejo que pueda sonar o confundir al toggle
    try { deckBRef.current?.removeAttribute('src'); deckBRef.current?.load() } catch {}
    activeRef.current = 'A'
    xfadeActive.current = false
    forgetObj('A')
    forgetObj('B')
    const a = audioRef.current
    if (!a) return
    a.src = url
    a.currentTime = 0
    setIndex(ni)
    recordPlay(track)
    setCurrentTime(0)
    const g = gainARef.current
    if (graphOk.current && ctx && g) {
      g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.03)
      a.play().then(() => {
        setIsPlaying(true)
        g.gain.setTargetAtTime(targetGain(store.volume), ctx.currentTime, 0.12)
      }).catch(() => setIsPlaying(false))
    } else {
      a.volume = Math.min(1, store.volume)
      a.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
    }
  }, [ensureGraph, resumeCtx])

  const playTrack = useCallback((track, list = null) => {
    ensureGraph()
    resumeCtx()
    stopSpeak()
    const q = list || queue
    const i = q.findIndex((t) => t.id === track.id)
    if (list) setQueuePersist(list)
    const ni = i >= 0 ? i : 0
    if (q[ni]?.id === current?.id) {
      activeAudio()?.play().catch(() => {})
      setIsPlaying(true)
      return
    }
    goTo(q, ni)
  }, [queue, current, ensureGraph, resumeCtx, setQueuePersist, goTo])

  const next = useCallback(async (auto = false) => {
    if (queue.length === 0) return
    if (repeat === 'one' && auto) {
      const a = activeAudio()
      if (a) { a.currentTime = 0; a.play().catch(() => {}) }
      return
    }
    if (shuffle) {
      let n = Math.floor(Math.random() * queue.length)
      if (queue.length > 1 && n === index) n = (n + 1) % queue.length
      stopSpeak()
      goTo(queue, n)
      return
    }
    if (index >= queue.length - 1) {
      // Radio infinita: en vez de parar, sigue con la misma vibra del tema actual
      if (auto && store.settings.automix) {
        try {
          const fresh = await continueVibe(current, queue.map((x) => x.id), 8)
          if (fresh.length) {
            const q2 = [...queue, ...fresh]
            setQueuePersist(q2)
            stopSpeak()
            goTo(q2, queue.length)
            return
          }
        } catch {}
      }
      if (repeat !== 'all' && auto) { setIsPlaying(false); return }
      stopSpeak()
      goTo(queue, 0)
      return
    }
    stopSpeak()
    goTo(queue, index + 1)
  }, [queue, index, shuffle, repeat, goTo, setQueuePersist])

  const prev = useCallback(() => {
    if (queue.length === 0) return
    const a = activeAudio()
    if (a && a.currentTime > 3) { a.currentTime = 0; return }
    stopSpeak()
    if (shuffle) { goTo(queue, Math.floor(Math.random() * queue.length)); return }
    goTo(queue, (index - 1 + queue.length) % queue.length)
  }, [queue, index, shuffle, goTo])

  const toggle = useCallback(() => {
    ensureGraph()
    resumeCtx()
    const a = activeAudio()
    if (!a || !current) return
    if (a.paused) { a.play().catch(() => {}); setIsPlaying(true) }
    else {
      if (dj) stopSpeak()
      // Pausa AMBOS decks: nunca queda uno sonando por un cambio rápido
      try { audioRef.current?.pause() } catch {}
      try { deckBRef.current?.pause() } catch {}
      setIsPlaying(false)
    }
  }, [current, ensureGraph, resumeCtx, dj])

  const seek = useCallback((sec) => {
    const a = activeAudio()
    if (a) a.currentTime = sec
  }, [])

  const removeAt = useCallback((qi) => {
    const q = queue.filter((_, i) => i !== qi)
    setQueuePersist(q)
    if (qi < index) { setIndex(index - 1); return }
    if (qi === index) {
      if (!q.length) {
        navToken.current++
        try { audioRef.current?.pause() } catch {}
        try { deckBRef.current?.pause() } catch {}
        setIndex(-1)
        return
      }
      goTo(q, Math.min(index, q.length - 1))
    }
  }, [queue, index, setQueuePersist, goTo])

  const clearUpNext = useCallback(() => {
    setQueue((q) => q.slice(0, index + 1))
  }, [index])

  // Reubica el índice sobre el tema actual tras reordenar/quitar varios
  const pinIndexToCurrent = useCallback((q, cur) => {
    if (!cur) return
    const ni = q.findIndex((x) => x.id === cur.id)
    if (ni >= 0) setIndex(ni)
  }, [])

  // Mover un tema dentro de la cola (arrastrar y soltar): el actual sigue sonando
  const moveQueue = useCallback((from, to) => {
    const q0 = queueRef.current
    if (from === to || from < 0 || to < 0 || from >= q0.length || to >= q0.length) return
    const cur = indexRef.current >= 0 ? q0[indexRef.current] : null
    const q = [...q0]
    const [t] = q.splice(from, 1)
    q.splice(to, 0, t)
    setQueuePersist(q)
    pinIndexToCurrent(q, cur)
  }, [setQueuePersist, pinIndexToCurrent])

  // Quitar varios temas a la vez (lista de índices de cola)
  const removeMany = useCallback((qis) => {
    const drop = new Set(qis)
    if (!drop.size) return
    const q0 = queueRef.current
    const cur = indexRef.current >= 0 ? q0[indexRef.current] : null
    const q = q0.filter((_, i) => !drop.has(i))
    setQueuePersist(q)
    if (!q.length) {
      navToken.current++
      try { audioRef.current?.pause() } catch {}
      try { deckBRef.current?.pause() } catch {}
      setIndex(-1)
      setIsPlaying(false)
      return
    }
    if (cur && !q.some((x) => x.id === cur.id)) goTo(q, Math.min(indexRef.current, q.length - 1))
    else pinIndexToCurrent(q, cur)
  }, [setQueuePersist, pinIndexToCurrent, goTo])

  // Temporizador de apagado: pausa todo al agotarse (solo sesión, sin persistir)
  const [sleepLeft, setSleepLeft] = useState(0) // segundos restantes, 0 = apagado
  const sleepEnd = useRef(0)
  const setSleep = useCallback((mins) => {
    if (!mins || mins <= 0) { sleepEnd.current = 0; setSleepLeft(0); return }
    sleepEnd.current = Date.now() + mins * 60000
    setSleepLeft(Math.round(mins * 60))
  }, [])
  useEffect(() => {
    if (!sleepLeft) return
    const iv = setInterval(() => {
      const left = Math.max(0, Math.round((sleepEnd.current - Date.now()) / 1000))
      setSleepLeft(left)
      if (left <= 0) {
        clearInterval(iv)
        try { audioRef.current?.pause() } catch {}
        try { deckBRef.current?.pause() } catch {}
        setIsPlaying(false)
      }
    }, 1000)
    return () => clearInterval(iv)
  }, [sleepLeft > 0]) // eslint-disable-line react-hooks/exhaustive-deps

  const cycleRepeat = useCallback(() => {
    setRepeat((r) => r === 'off' ? 'all' : r === 'all' ? 'one' : 'off')
  }, [])

  // Modo AI DJ (voz entre temas)
  const setDjMode = useCallback((on) => {
    setDj(on)
    if (!on) stopSpeak()
  }, [])

  // Reintento del mismo tema antes de saltar: el 302 de Audius hacia el
  // creator node falla de forma transitoria; recargar con cache-buster lo
  // suele arreglar sin perder el tema. Solo un reintento por tema.
  const errRetryRef = useRef({ id: null, n: 0 })
  const onAudioError = useCallback(() => {
    const cur = queueRef.current[indexRef.current]
    const key = cur?.id ?? null
    const already = errRetryRef.current.id === key ? errRetryRef.current.n : 0
    if (already < 1 && cur?.streamUrl) {
      errRetryRef.current = { id: key, n: already + 1 }
      const a = activeAudio()
      if (a) {
        const sep = cur.streamUrl.includes('?') ? '&' : '?'
        setAudioError(t('pb.retrying'))
        try {
          a.src = `${cur.streamUrl}${sep}retry=${Date.now() % 100000}`
          a.load()
          a.play().catch(() => {})
        } catch {}
        return
      }
    }
    if (queue.length <= 1) {
      setAudioError(t('pb.trackError'))
      setIsPlaying(false)
      return
    }
    setAudioError(t('pb.trackErrorNext'))
    setTimeout(() => next(false), 1200)
  }, [next, queue.length])

  // Watchdog anti-trabas: si dice "sonando" pero el tiempo no avanza ni hay datos
  // (red lenta o CDN caído), reintenta una vez y si sigue trabado pasa al siguiente.
  const stallRef = useRef({ t: -1, since: 0, retried: false })
  useEffect(() => {
    stallRef.current = { t: -1, since: 0, retried: false }
    if (!current) return
    const iv = setInterval(() => {
      const s = stallRef.current
      const a = activeAudio()
      if (!isPlaying || !a || a.paused || a.seeking) { s.t = -1; return }
      if (a.readyState >= 3) { s.t = a.currentTime; s.since = Date.now(); return }
      if (s.t < 0 || a.currentTime !== s.t) { s.t = a.currentTime; s.since = Date.now(); return }
      const stuck = Date.now() - s.since
      if (stuck > 8000 && !s.retried) { s.retried = true; a.play().catch(() => {}) }
      else if (stuck > 20000) {
        s.t = -1; s.retried = false
        setAudioError(t('pb.stuckNext'))
        setTimeout(() => next(false), 1200)
      }
    }, 4000)
    return () => clearInterval(iv)
  }, [isPlaying, current?.id, next]) // eslint-disable-line react-hooks/exhaustive-deps

  // Eventos: solo el deck activo manda (tiempo, duración, fin, error)
  const isActiveEl = (e) => e.target === activeAudio()
  const handleTime = (e) => {
    if (!isActiveEl(e)) return
    const a = e.target
    setCurrentTime(a.currentTime)
    // Crossfade automático: entra el siguiente antes de que termine
    const secs = Number(store.settings.crossfade || 0)
    if (secs > 0 && a.duration && isFinite(a.duration) && current) {
      const left = a.duration - a.currentTime
      if (left <= secs && left > 0 && xfadeSched.current !== current.id) {
        xfadeSched.current = current.id
        next(true)
      }
    }
  }

  // Título al cambiar de tema (el DJ habla solo una vez al iniciar, no entre temas)
  useEffect(() => {
    document.title = current ? `${current.title} • ${current.artist} — Sonder` : 'Sonder — Streaming gratuito y legal'
  }, [current?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    stopSpeak()
    if (xfadeTimer.current) clearTimeout(xfadeTimer.current)
    forgetObj('A')
    forgetObj('B')
  }, [])

  const deckEvents = {
    onTimeUpdate: handleTime,
    onLoadedMetadata: (e) => { if (isActiveEl(e)) setDuration(e.target.duration) },
    onEnded: (e) => { if (isActiveEl(e) && xfadeSched.current !== current?.id) next(true) },
    onError: (e) => { if (isActiveEl(e)) onAudioError() },
    onPlay: (e) => { if (isActiveEl(e)) setIsPlaying(true) },
    onPause: (e) => { if (isActiveEl(e)) setIsPlaying(false) },
  }

  // Recarga anticipada: cuando quedan ≤3 temas, la radio ya trae más de la misma
  // vibra en segundo plano (sin espera al terminar). Tope de seguridad: 150.
  const refilling = useRef(false)
  useEffect(() => {
    if (!store.settings.automix || queue.length === 0 || index < 0) return
    if (queue.length >= 150 || index < queue.length - 3 || refilling.current) return
    refilling.current = true
    const cur = queueRef.current[indexRef.current]
    continueVibe(cur, queueRef.current.map((x) => x.id), 8)
      .then((fresh) => {
        if (fresh?.length) setQueuePersist([...queueRef.current, ...fresh])
      })
      .catch(() => {})
      .finally(() => { refilling.current = false })
  }, [index, queue.length, setQueuePersist]) // eslint-disable-line react-hooks/exhaustive-deps

  // Atajos de teclado globales (se ignoran escribiendo en inputs)
  // Espacio = play/pausa • ←/→ = anterior/siguiente (con Shift: ∓5s) • ↑/↓ = volumen • M = silencio
  useEffect(() => {
    const onKey = (e) => {
      const el = e.target
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.code === 'Space') { e.preventDefault(); toggle(); }
      else if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (e.shiftKey) seek((currentTime || 0) + 5)
        else next(false)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (e.shiftKey) seek(Math.max(0, (currentTime || 0) - 5))
        else prev()
      } else if (e.key === 'ArrowUp') { e.preventDefault(); setVolume(volume + 0.05) }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setVolume(volume - 0.05) }
      else if (e.key === 'm' || e.key === 'M') { setVolume(volume === 0 ? 0.7 : 0) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle, next, prev, seek, setVolume, volume, currentTime])

  return (
    <PlayerContext.Provider value={{
      current, queue, index, isPlaying, volume, currentTime, duration,
      shuffle, repeat, audioError, dj, sleepLeft,
      playTrack, toggle, next: () => next(false), prev, seek, setVolume,
      setQueue: setQueuePersist, setShuffle, cycleRepeat, removeAt, clearUpNext,
      moveQueue, removeMany, setSleep,
      setDjMode,
    }}>
      <audio ref={audioRef} {...deckEvents} />
      <audio ref={deckBRef} {...deckEvents} />
      {children}
    </PlayerContext.Provider>
  )
}

export function usePlayer() {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer debe usarse dentro de PlayerProvider')
  return ctx
}
