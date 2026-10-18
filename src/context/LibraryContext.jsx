import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { store, parseStored, isObj } from '../lib/store.js'
import { useAuth } from './AuthContext.jsx'
import { pullCloud, mergeLibrary, pushCloud } from '../lib/cloud.js'

const LibraryContext = createContext(null)
const uid = () => Math.random().toString(36).slice(2, 9)

export function LibraryProvider({ children }) {
  const [likes, setLikes] = useState(() => store.likes)
  const [playlists, setPlaylists] = useState(() => store.playlists)
  const [followed, setFollowed] = useState(() => {
    try {
      const v = parseStored(localStorage.getItem('sonder:followed'), [])
      return v.filter((a) => isObj(a) && a.id !== undefined && a.id !== null)
    } catch { return [] }
  })

  const { user } = useAuth()
  const userId = user?.id || null
  const pulledFor = useRef(null)
  const cloudReady = useRef(false)

  useEffect(() => { store.likes = likes }, [likes])
  useEffect(() => { store.playlists = playlists }, [playlists])
  useEffect(() => { try { localStorage.setItem('sonder:followed', JSON.stringify(followed)) } catch {} }, [followed])

  // Al iniciar sesión: baja la nube y une con lo local (una vez por usuario)
  useEffect(() => {
    if (!userId || pulledFor.current === userId) return
    pulledFor.current = userId
    cloudReady.current = false
    pullCloud(userId).then((cloud) => {
      if (cloud && !cloud.missing) {
        const merged = mergeLibrary(cloud)
        if (merged && !merged.missing) {
          setLikes(merged.likes)
          setPlaylists(merged.playlists)
          setFollowed(merged.followed)
        }
      }
      cloudReady.current = true
    })
  }, [userId])

  // Sube cambios a la nube (con debounce interno, tras el primer pull)
  useEffect(() => {
    if (!userId || !cloudReady.current) return
    pushCloud(userId, { likes, playlists, followed })
  }, [userId, likes, playlists, followed])

  const followArtist = useCallback((artist) => {
    setFollowed((prev) => prev.some((a) => a.id === artist.id)
      ? prev.filter((a) => a.id !== artist.id)
      : [...prev, { id: artist.id, name: artist.name, artwork: artist.artwork || null }])
  }, [])

  const isFollowing = useCallback((id) => followed.some((a) => a.id === id), [followed])

  // Página de playlist: qué playlist se muestra a pantalla completa (estilo Spotify)
  const [playlistView, setPlaylistView] = useState(null) // playlistId | null
  const openPlaylist = useCallback((id) => { if (id) setPlaylistView(id) }, [])
  const closePlaylist = useCallback(() => setPlaylistView(null), [])
  const renamePlaylist = useCallback((id, name) => {
    const n = (name || '').trim().slice(0, 60)
    if (!n) return
    setPlaylists((prev) => prev.map((p) => (p.id === id ? { ...p, name: n } : p)))
  }, [])

  // Vista de autor: qué ficha de artista se muestra a pantalla completa
  const [artistView, setArtistView] = useState(null) // {id, name?} | null
  const openArtist = useCallback((artist) => {
    if (!artist) return
    setArtistView(typeof artist === 'string' ? { id: artist } : { id: artist.id, name: artist.name })
  }, [])
  const closeArtist = useCallback(() => setArtistView(null), [])

  const cacheTrack = (track) => {
    try {
      const cache = JSON.parse(localStorage.getItem('sonder:tracks') || '{}')
      cache[track.id] = track
      const keys = Object.keys(cache)
      while (keys.length > 200) delete cache[keys.shift()]
      localStorage.setItem('sonder:tracks', JSON.stringify(cache))
    } catch {}
  }

  const [likedAt, setLikedAt] = useState(() => {
    // Migra likes viejos sin fecha: se estampan ahora (conservan su orden)
    const m = store.likedAt || {}
    const now = Date.now()
    let dirty = false
    store.likes.forEach((id, i) => { if (!(id in m)) { m[id] = now - (store.likes.length - i); dirty = true } })
    if (dirty) store.likedAt = m
    return m
  })
  useEffect(() => { store.likedAt = likedAt }, [likedAt])

  const toggleLike = useCallback((track) => {
    // La biblioteca lee el track completo desde la caché: hay que guardarlo al dar like
    cacheTrack(track)
    const id = track.id
    setLikes((prev) => {
      const has = prev.includes(id)
      if (has) {
        setLikedAt((m) => { const n = { ...m }; delete n[id]; return n })
        return prev.filter((x) => x !== id)
      }
      setLikedAt((m) => ({ ...m, [id]: Date.now() }))
      return [id, ...prev] // lo nuevo arriba, como en Spotify
    })
  }, [])

  const isLiked = useCallback((id) => likes.includes(id), [likes])

  const createPlaylist = useCallback((name) => {
    const p = { id: uid(), name: name.trim() || 'Nueva playlist', trackIds: [], created: Date.now() }
    setPlaylists((prev) => [p, ...prev])
    return p.id
  }, [])

  const deletePlaylist = useCallback((id) => {
    setPlaylists((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const addToPlaylist = useCallback((playlistId, track) => {
    setPlaylists((prev) => prev.map((p) =>
      p.id === playlistId && !p.trackIds.includes(track.id)
        ? { ...p, trackIds: [...p.trackIds, track.id] } : p
    ))
    // Guarda el track completo para poder reproducirlo desde la lista
    try {
      const cache = JSON.parse(localStorage.getItem('sonder:tracks') || '{}')
      cache[track.id] = track
      const keys = Object.keys(cache)
      while (keys.length > 200) delete cache[keys.shift()]
      localStorage.setItem('sonder:tracks', JSON.stringify(cache))
    } catch {}
  }, [])

  const removeFromPlaylist = useCallback((playlistId, trackId) => {
    setPlaylists((prev) => prev.map((p) =>
      p.id === playlistId ? { ...p, trackIds: p.trackIds.filter((id) => id !== trackId) } : p
    ))
  }, [])

  const getTrackCache = useCallback(() => {
    try {
      const v = parseStored(localStorage.getItem('sonder:tracks'), {})
      return isObj(v) ? v : {}
    } catch { return {} }
  }, [])

  return (
    <LibraryContext.Provider value={{ likes, likedAt, playlists, toggleLike, isLiked, createPlaylist, deletePlaylist, addToPlaylist, removeFromPlaylist, renamePlaylist, getTrackCache, followed, followArtist, isFollowing, artistView, openArtist, closeArtist, playlistView, openPlaylist, closePlaylist }}>
      {children}
    </LibraryContext.Provider>
  )
}

export function useLibrary() {
  const ctx = useContext(LibraryContext)
  if (!ctx) throw new Error('useLibrary dentro de LibraryProvider')
  return ctx
}
