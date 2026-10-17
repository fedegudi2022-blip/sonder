// Idiomas de Sonder: Español + English.
// - `t(clave, vars)` para strings (fuera de React también vale).
// - `useT()` en componentes: re-renderiza solo cuando cambia el idioma.
// - Idioma y región se guardan en store.settings (lang, region).
// - Clave ausente: cae a español y luego a la clave (nunca rompe la UI).

import { useEffect, useReducer } from 'react'
import { store } from './store.js'

export const LANGS = { es: 'Español', en: 'English' }
export const REGIONS = ['latam', 'spain', 'brasil', 'usa', 'other']

const listeners = new Set()
const notify = () => listeners.forEach((f) => f())

export function browserLang() {
  const n = (navigator.language || '').toLowerCase()
  if (n.startsWith('es')) return 'es'
  if (n.startsWith('pt')) return 'es' // sin portugués aún: español le es más cercano
  if (n.startsWith('en')) return 'en'
  return 'es' // Sonder nació en español: default conservador
}

export function detectRegion() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    if (tz.startsWith('America/Argentina')) return 'latam'
    if (tz.startsWith('America/')) return 'latam'
    if (tz === 'Europe/Madrid' || tz.startsWith('Europe/')) return 'spain'
  } catch {}
  return ((navigator.language || '').toLowerCase().startsWith('en')) ? 'usa' : 'other'
}

export function getLang() {
  const s = store.settings.lang
  return s === 'en' || s === 'es' ? s : browserLang()
}

export function getRegion() {
  return store.settings.region || null
}

// Región latina (elegida o detectada): prioriza contenido en español/latino
export function isLatinoRegion() {
  const r = getRegion()
  if (r === 'latam' || r === 'spain' || r === 'brasil') return true
  if (r) return false
  return false
}

export function setLang(l) {
  if (l !== 'en' && l !== 'es') return
  store.settings = { ...store.settings, lang: l }
  try { document.documentElement.lang = l } catch {}
  notify()
}

export function setRegion(r) {
  store.settings = { ...store.settings, region: r }
  notify()
}

try { document.documentElement.lang = getLang() } catch {}

function fill(str, vars) {
  if (!vars) return str
  return String(str).replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''))
}

export function t(key, vars) {
  const l = getLang()
  const d = DICT[l] || {}
  const hit = d[key] ?? DICT.es[key] ?? key
  return fill(hit, vars)
}

export function useT() {
  const [, force] = useReducer((x) => x + 1, 0)
  useEffect(() => { listeners.add(force); return () => { listeners.delete(force) } }, [])
  return { t, lang: getLang(), setLang, setRegion, region: getRegion() }
}

const DICT = {
es: {
  'nav.home': 'Inicio', 'nav.search': 'Buscar', 'nav.discover': 'Descubrir',
  'nav.profile': 'Tu perfil', 'nav.library': 'Tu biblioteca', 'nav.playlists': 'Playlists',
  'nav.firstPlaylist': 'Crea tu primera playlist en Biblioteca',
  'nav.liked': 'Mis me gustas', 'nav.nowPlaying': 'Sonando ahora', 'nav.paused': 'En pausa',
  'nav.legal': 'Música 100% legal', 'nav.legalSub': 'Audius • Jamendo',
  'header.searchPh': 'Busca canciones o géneros…', 'header.clear': 'Limpiar',
  'header.login': 'Iniciar sesión', 'header.logout': 'Salir',
  'home.trending': 'Trending ahora', 'home.explore': 'Explorar',
  'home.soundIs': 'Tu sonido: {g} • ', 'home.themes': '{n} temas',
  'home.shuffle': 'Reproducción al azar', 'home.songs': 'Canciones', 'home.albums': 'Álbumes',
  'home.all': 'Todo', 'home.trick': 'Truco:', 'home.trickCombine': 'combínalos como quieras',
  'home.resultType': 'Tipo de resultado', 'home.selected': 'Seleccionado', 'home.viewSongs': 'Ver temas',
  'home.albumsEmpty': 'Sin álbumes. Prueba otro nombre.',
  'home.updating': 'Actualizando…', 'home.noResults': 'Sin resultados. Prueba “house”, “lofi”, o cambia de género.',
  'home.officialArtist': 'Artista oficial • Todas completas', 'home.sameAuthor': 'Del mismo autor',
  'home.fullTracks': '{n}{total} temas completos • ',
  'home.versionsNote': 'versiones de Audius (el máster original solo está en Apple Music/Spotify de pago)',
  'home.topNote': 'su top', 'home.playTop': 'Reproducir top de {name}', 'home.playTopShort': 'Reproducir su top',
  'home.moreResults': 'Más resultados', 'home.didYouMean': '¿Buscabas a…?', 'home.artists': 'Artistas', 'home.artistsEmpty': 'Sin autores para esta búsqueda.',  'home.tapToResolve': 'Toca para ver sus versiones completas', 'home.officialSong': 'Original oficial', 'home.fullVersionBy': 'Versión completa · subida por {name}', 'home.fresh': 'Recién subido',
  'home.freshSub': 'Lo último subido, ordenado por fecha de subida.',
  'home.latino': 'Puro latino', 'home.latinoSub': 'Reggaetón, cumbia, trap latino y dembow de Audius.',
  'home.argentina': 'Hecho en Argentina', 'home.argentinaSub': 'Trap, cumbia y cuarteto detectados por tu zona horaria.',
  'home.relatedSub': 'Según tu lista de Me gustas.',
  'home.recommended': 'Recomendadas', 'home.recommendedTop': '(tu género top: {g})',
  'home.recommendedSub': 'Según lo que más escuchas{top}.', 'home.trendingWord': 'Trending',
  'home.source': 'Fuente: Audius legal vía API. Tus selecciones se recuerdan en este equipo.',
  'uni.universeTitle': 'Todos los autores', 'uni.universeSub': 'El universo completo (MusicBrainz): aunque no suban a Audius, aquí está su ficha y su discografía.',
  'uni.openProfile': 'Abrir ficha', 'uni.loading': 'Abriendo ficha universal…',
  'uni.universeBadge': 'Ficha universal', 'uni.artistWord': 'Artista',
  'uni.hearTop': 'Escuchar su top', 'uni.more': 'Leer más', 'uni.less': 'Leer menos',
  'uni.officialSite': 'Sitio oficial', 'uni.discography': 'Discografía ({n})',
  'uni.discNote': 'Toca un disco para buscar sus versiones completas en Sonder.',
  'uni.findVersions': 'Buscar versiones completas', 'uni.noReleases': 'Sin discografía registrada.',
  'uni.album': 'Álbum', 'uni.single': 'Sencillo',
  'up.title': 'App de escritorio', 'up.sub': 'Versión instalada: {v}.',
  'up.check': 'Buscar actualizaciones', 'up.checking': 'Buscando…',
  'up.uptodate': 'Ya tienes la última versión ✓', 'up.downloading': 'Descargando {p}%…',
  'up.installing': 'Instalando y reiniciando…',
  'up.web': 'Estás en la versión web: aquí no hay nada que actualizar. En el .exe este botón descarga e instala solo.',
  'up.error': 'No se pudo actualizar. Revisa tu internet e inténtalo de nuevo.',
  'home.loadError': 'No se pudo cargar la música. Revisa tu internet.',
  'home.openAlbumError': 'No se pudo abrir el álbum.',
  'home.album': 'Álbum', 'home.playlist': 'Playlist', 'home.plays': '{n} plays',
  'home.themesCount': '{n} temas', 'home.inFav': 'En favoritas',
  'lib.title': 'Tu biblioteca', 'lib.sub': 'Se guarda en este equipo. Con login Supabase se sincronizará en la nube.',
  'lib.likedPlaylist': 'Playlist', 'lib.likedTitle': 'Mis me gustas',
  'lib.likedCount': '{n} canciones{dur}', 'lib.likedDur': ', {d}',
  'lib.playLiked': 'Reproducir Mis me gustas', 'lib.play': 'Reproducir',
  'lib.emptyLikes': 'Toca el corazón en cualquier canción para guardarla aquí.',
  'lib.sort': 'Ordenar', 'lib.sortRecent': 'Agregado recientemente', 'lib.sortActivity': 'Por actividad',
  'lib.sortPlays': 'Más plays', 'lib.sortAZ': 'A–Z', 'lib.noFilter': 'Nada con ese filtro. Cambia de género.',
  'lib.playlists': 'Playlists ({n})', 'lib.playlistNamePh': 'Nombre de playlist…', 'lib.create': 'Crear',
  'lib.emptyPl': 'Vacía. Ve a Inicio, abre “+” en una canción y añádela aquí.',
  'lib.delete': 'Borrar', 'lib.touch': 'Tocar', 'lib.enhance': 'Mejorar', 'lib.remove': 'Quitar',
  'dis.title': 'Descubrir', 'dis.sub': 'Mixes hechos con tu gusto • Nada sale de tu equipo',
  'dis.djOn': 'Sonando tu mezcla. Al detenerme, la música también para.',
  'dis.djOff': 'Te saluda una vez y después deja solo la música.',
  'dis.startDj': 'Iniciar DJ', 'dis.stopDj': 'Detener DJ',
  'dis.noVoice': 'Tu navegador no tiene voz (Web Speech API). Los mixes igual funcionan.',
  'dis.building': 'Armando tus mixes…', 'dis.dailySub': '{n} temas • se renueva mañana',
  'dis.dailyAlt': 'Según tu género top y favoritas', 'dis.todayMix': 'Tu mezcla de hoy',
  'dis.weekly': 'Descubrimiento Semanal', 'dis.weeklyTitle': 'Sal de tu burbuja',
  'dis.weeklySub': 'Explorando: {g}', 'dis.weeklyAlt': 'Géneros que casi no escuchas',
  'dis.daylistAlt': 'Según tu hora', 'dis.daylistAltSub': 'Cambia con el momento del día',
  'dis.nowHour': 'Ahora suena tu hora', 'dis.taste': 'Tu Taste Profile',
  'dis.tasteSub': 'Tu gusto sale de lo que escuchas. Lo excluido no influye en mixes, DJ ni Enhance.',
  'dis.tasteEmpty': 'Escucha algo y tu perfil aparece solo.',
  'dis.excluded': 'Excluidas ({n})', 'dis.excludedEmpty': 'Toca “No me influye” en una tarjeta (menú +) para excluirla.',
  'dis.backIn': 'Volver a incluir', 'dis.foot': 'DJ con voz local (Web Speech API). Sin cuentas ni claves.',
  'dis.pauseMix': 'Pausar {name}', 'dis.playMix': 'Reproducir {name}',
  'dis.djGreeting': '¡Hola! Te armé esta mezcla con tu gusto, mucho {g}. ¡Que la disfrutes!',
  'dis.djGreetingAlt': '¡Hola! Te armé esta mezcla con de lo mejor de Audius. ¡Que la disfrutes!',
  'pro.profile': 'Perfil', 'pro.guest': 'Invitado', 'pro.noSession': ' (sin sesión)',
  'pro.syncHint': 'Inicia sesión para sincronizar en la nube',
  'pro.listened': 'escuchados', 'pro.playsSub': 'reproducciones ({n} temas únicos)',
  'pro.fav': 'favoritas', 'pro.playlistsSub': 'playlists ({n} temas)',
  'pro.topGenre': 'tu género top', 'pro.design': 'Diseño', 'pro.accent': 'Color de acento',
  'pro.density': 'Densidad de tarjetas', 'pro.comfy': 'Cómoda', 'pro.compact': 'Compacta',
  'pro.audio': 'Audio', 'pro.crossfade': 'Crossfade (transición suave entre temas)',
  'pro.radio': 'Radio infinita ∞: la cola nunca se acaba, sigue sola con la misma vibra',
  'pro.yes': 'Sí', 'pro.no': 'No', 'pro.quality': 'Calidad de streaming',
  'pro.high': 'Alta', 'pro.saver': 'Ahorro',
  'pro.qualityNote': 'Audius solo sirve audio comprimido: Alta usa lo máximo disponible. No hay FLAC real y no lo fingimos.',
  'pro.djVoice': 'Voz del AI DJ', 'pro.withVoice': 'Con voz', 'pro.musicOnly': 'Solo música',
  'pro.language': 'Idioma / Language', 'pro.languageSub': 'Todo Sonder en tu idioma. Se aplica al instante.',
  'pro.region': 'Región', 'pro.regionSub': 'Prioriza contenido de tu zona (latino, argentino, etc.).',
  'pro.data': 'Datos', 'pro.dataSub': 'Borra favoritas, playlists, historial y ajustes de este equipo. Tu cuenta queda intacta.',
  'pro.clearData': 'Borrar datos locales',
  'pro.confirmClear': '¿Borrar tus datos locales (favoritas, playlists, historial y ajustes)?',
  'pro.foot': 'Inicial: {i} • Las estadísticas salen de tu historial local de escucha.',
  'pro.accentNames': 'Verde Sonder|Azul|Violeta|Naranja|Rojo',
  'pb.choose': 'Elige una canción', 'pb.tapAny': 'Toca cualquier tarjeta para escuchar',
  'pb.like': 'Me gusta', 'pb.shuffle': 'Aleatorio', 'pb.prev': 'Anterior', 'pb.play': 'Reproducir',
  'pb.pause': 'Pausa', 'pb.next': 'Siguiente', 'pb.repeat': 'Repetir',
  'pb.repeatTip': 'Sin repetición|Repetir todo|Repetir una',
  'pb.queue': 'Cola', 'pb.progress': 'Progreso', 'pb.sleep': 'Temporizador de apagado',
  'pb.sleepTitle': 'Se apaga en {t} (clic para cambiar)',
  'pb.sleepCycle': 'Temporizador: 15 • 30 • 60 min • apagado',
  'pb.mute': 'Silenciar', 'pb.volume': 'Volumen', 'pb.close': 'Cerrar', 'pb.details': 'Detalles',
  'pb.upcoming': 'Sonando + {n} siguientes', 'pb.all': 'Todas', 'pb.removeN': 'Quitar ({n})',
  'pb.saveQueue': 'Guardar cola', 'pb.saved': '¡Guardada!', 'pb.clear': 'Limpiar',
  'pb.saveQueueTitle': 'Guardar la cola actual como playlist en tu Biblioteca',
  'pb.radioOn': '∞ Radio ON', 'pb.radioOff': '∞ Radio OFF',
  'pb.radioOnTitle': 'Radio infinita activada: al terminar sigue con la misma vibra (clic para apagar)',
  'pb.radioOffTitle': 'Radio infinita apagada: la cola termina (clic para encender)',
  'pb.nowPlaying': 'Sonando ahora', 'pb.emptyQueue': 'No hay más temas en la cola.',
  'pb.noDetail': 'Reproduce algo para ver su ficha.', 'pb.loadingDetail': 'Cargando ficha…',
  'pb.noDetailTrack': 'Sin detalles para este tema.',
  'pb.noDesc': 'Sin descripción del artista.', 'pb.released': 'Sale',
  'pb.key': 'Tono', 'pb.mood': 'Ánimo',
  'pb.tags': 'Tags:', 'pb.viaFull': 'Ficha vía Audius • Letra vía LRCLIB.',
  'pb.viaLyrics': 'Ficha no disponible • Letra vía LRCLIB.',
  'pb.lyricsErr': 'No se pudo cargar la letra.', 'pb.lyricsMissing': 'Sin letra para este tema todavía.',
  'pb.synced': 'Letra sincronizada', 'pb.lyrics': 'Letra', 'pb.karaoke': 'Karaoke',
  'pb.karaokeTitle': 'Karaoke a pantalla completa (con traducción)',
  'pb.preview': 'Preview 30s', 'pb.inLikes': 'En Mis me gustas', 'pb.addLikes': 'Añadir a Mis me gustas',
  'pb.addToPl': 'Añadir a playlist', 'pb.select': 'Seleccionar {t}', 'pb.removeFromQ': 'Quitar de la cola',
  'pb.trackError': 'Ese track no se pudo reproducir.',
  'pb.trackErrorNext': 'Ese track no se pudo reproducir, paso al siguiente…',
  'pb.stuckNext': 'La conexión se trabó, paso al siguiente…',
  'pb.queueOf': 'Cola del {d}',
  'k.close': 'Cerrar karaoke', 'k.showOriginal': 'Ver original', 'k.showEs': 'Ver en español',
  'k.translating': 'Traduciendo…', 'k.trError': 'No se pudo traducir (límite del servicio). La original sigue abajo.',
  'k.noTime': 'Letra sin tiempos: sin resaltado, pero puedes leer y traducir.',
  'k.hint': 'Clic en una línea para saltar • Esc para salir',
  'k.noLyrics': 'Sin letra para este tema todavía.', 'k.of': 'Karaoke de {t}',
  'k.jump': 'Saltar a esta línea',
  'auth.login': 'Iniciar sesión', 'auth.signup': 'Crear cuenta', 'auth.enter': 'Entrar',
  'auth.register': 'Registro', 'auth.password': 'Contraseña', 'auth.min6': 'Mínimo 6 caracteres',
  'auth.wait': 'Espera…', 'auth.createdOk': 'Cuenta creada. Revisa tu email si Supabase pide confirmación, luego inicia sesión.',
  'auth.orContinue': 'o continúa con', 'auth.opening': 'Abriendo…', 'auth.close': 'Cerrar',
  'auth.localMode': 'Modo local: crea tu proyecto gratis en supabase.com, copia URL + anon key a un archivo .env y recarga.',
  'auth.noSupabase': 'Falta configurar Supabase (.env). Sigue en modo local.',
  'row.play': 'Reproducir {t}', 'row.likedTitle': 'En Mis me gustas', 'row.addLikesTitle': 'Añadir a Mis me gustas',
  'row.createFirst': 'Crea una playlist en Biblioteca primero',
  'row.noInfluence': 'No me influye', 'row.noInfluenceTitle': 'No influirá en mixes, DJ ni Enhance',
  'time.now': 'recién', 'time.min': 'hace {n} min', 'time.hour': 'hace {n} h',
  'time.day': 'hace {n} d', 'time.week': 'hace {n} sem',
  'time.month': 'hace {n} mes|hace {n} meses', 'time.year': 'hace {n} año|hace {n} años',
  'day.kickoff': '{d} de arranque', 'day.midday': '{d} al mediodía', 'day.creative': '{d} creativa',
  'day.sunset': '{d} al atardecer', 'day.late': '{d} de madrugada',
  'day.kickoffD': 'Energía progresiva para empezar el día.', 'day.middayD': 'Ritmo alto para la mitad del día.',
  'day.creativeD': 'Foco y groove para la tarde.', 'day.sunsetD': 'Bajando la intensidad con estilo.',
  'day.lateD': 'Sonido profundo para la noche.',
  'rel.becauseLike': 'Porque te gusta {name}', 'rel.moreLike': 'Más {g} como tus me gustas',
  'rel.according': 'Según tu lista de Me gustas.',
  'dj.openers': 'Suena {title}, de {artist}.|Te pongo {title} de {artist}.|Vamos con {title}, de {artist}.',
  'dj.topGenre': 'Va con tu semana: mucho {g}.', 'dj.genre': 'Para abrir el oído: {g}.',
  'dj.hot': 'Está pegando fuerte en Audius.', 'dj.fresh': 'Descubrimiento fresco para ti.',
  'w.title': 'Bienvenido a Sonder', 'w.sub': '¿De dónde eres? Así ponemos tu idioma y tu música primero.',
  'w.latam': 'Latinoamérica', 'w.spain': 'España', 'w.brasil': 'Brasil',
  'w.usa': 'USA / English', 'w.other': 'Otro lugar',
  'w.regionLabel': 'Región',
  'w.langLabel': 'Idioma de la app', 'w.continue': 'Empezar a escuchar', 'w.skip': 'Ahora no',
  'w.note': 'Podrás cambiarlo cuando quieras en Tu perfil.',
  'artist.kicker': 'Autor original', 'artist.follow': 'Seguir', 'artist.following': 'Siguiendo',
  'artist.followers': 'seguidores', 'artist.top': 'Su top', 'artist.albums': 'Álbumes ({n})',
  'artist.empty': 'Este autor aún no tiene temas reproducibles.', 'artist.tracks': '{n} temas',
  'artist.verified': 'Artista verificado', 'artist.originals': 'Originales del autor', 'artist.versions': 'Versiones y remixes ({n})',
  'err.title': 'Algo se rompió', 'err.sub': 'Sonder no pudo mostrar esta pantalla. Puedes reintentar o borrar los datos locales y empezar de cero.',  'err.retry': 'Reintentar', 'err.reset': 'Borrar datos locales', 'pb.retrying': 'Reintentando…',
  'err.detail': 'Detalle técnico', 'k.syncTitle': 'Ajustar sincronía de la letra', 'k.syncBack': 'Atrasar letra 0.5 segundos', 'k.syncFwd': 'Adelantar letra 0.5 segundos', 'k.syncReset': 'Volver a sincronía 0',
},
en: {
  'nav.home': 'Home', 'nav.search': 'Search', 'nav.discover': 'Discover',
  'nav.profile': 'Your profile', 'nav.library': 'Your library', 'nav.playlists': 'Playlists',
  'nav.firstPlaylist': 'Create your first playlist in Library',
  'nav.liked': 'Liked songs', 'nav.nowPlaying': 'Now playing', 'nav.paused': 'Paused',
  'nav.legal': '100% legal music', 'nav.legalSub': 'Audius • Jamendo',
  'header.searchPh': 'Search songs or genres…', 'header.clear': 'Clear',
  'header.login': 'Log in', 'header.logout': 'Log out',
  'home.trending': 'Trending now', 'home.explore': 'Browse',
  'home.soundIs': 'Your sound: {g} • ', 'home.themes': '{n} tracks',
  'home.shuffle': 'Shuffle play', 'home.songs': 'Songs', 'home.albums': 'Albums',
  'home.all': 'All', 'home.trick': 'Tip:', 'home.trickCombine': 'combine them however you like',
  'home.resultType': 'Result type', 'home.selected': 'Selected', 'home.viewSongs': 'View tracks',
  'home.albumsEmpty': 'No albums. Try another name.',
  'home.updating': 'Updating…', 'home.noResults': 'No results. Try “house”, “lofi”, or switch genre.',
  'home.officialArtist': 'Official artist • All full-length', 'home.sameAuthor': 'More by this artist',
  'home.fullTracks': '{n}{total} full tracks • ',
  'home.versionsNote': 'Audius versions (the original master is only on paid Apple Music/Spotify)',
  'home.topNote': 'their top', 'home.playTop': 'Play top by {name}', 'home.playTopShort': 'Play their top',
  'home.moreResults': 'More results', 'home.didYouMean': 'Did you mean…?', 'home.artists': 'Artists', 'home.artistsEmpty': 'No artists for this search.',  'home.tapToResolve': 'Tap to see full versions', 'home.officialSong': 'Official original', 'home.fullVersionBy': 'Full version · uploaded by {name}', 'home.fresh': 'Fresh uploads',
  'home.freshSub': 'The latest uploads, sorted by upload date.',
  'home.latino': 'Pure Latin', 'home.latinoSub': 'Reggaetón, cumbia, Latin trap and dembow from Audius.',
  'home.argentina': 'Made in Argentina', 'home.argentinaSub': 'Trap, cumbia and cuarteto matched by your timezone.',
  'home.relatedSub': 'Based on your Liked songs.',
  'home.recommended': 'Recommended', 'home.recommendedTop': '(your top genre: {g})',
  'home.recommendedSub': 'Based on what you listen to most{top}.', 'home.trendingWord': 'Trending',
  'home.source': 'Source: legal Audius API. Your picks stay on this device.',
  'uni.universeTitle': 'All artists', 'uni.universeSub': 'The full universe (MusicBrainz): even if they don’t upload to Audius, their profile and discography are here.',
  'uni.openProfile': 'Open profile', 'uni.loading': 'Opening universal profile…',
  'uni.universeBadge': 'Universal profile', 'uni.artistWord': 'Artist',
  'uni.hearTop': 'Play their top', 'uni.more': 'Read more', 'uni.less': 'Read less',
  'uni.officialSite': 'Official site', 'uni.discography': 'Discography ({n})',
  'uni.discNote': 'Tap a release to search its full versions in Sonder.',
  'uni.findVersions': 'Find full versions', 'uni.noReleases': 'No registered discography.',
  'uni.album': 'Album', 'uni.single': 'Single',
  'up.title': 'Desktop app', 'up.sub': 'Installed version: {v}.',
  'up.check': 'Check for updates', 'up.checking': 'Checking…',
  'up.uptodate': 'You already have the latest version ✓', 'up.downloading': 'Downloading {p}%…',
  'up.installing': 'Installing and restarting…',
  'up.web': 'You are on the web version: nothing to update here. In the .exe this button downloads and installs automatically.',
  'up.error': 'Couldn’t update. Check your connection and try again.',
  'home.loadError': 'Couldn’t load the music. Check your connection.',
  'home.openAlbumError': 'Couldn’t open the album.',
  'home.album': 'Album', 'home.playlist': 'Playlist', 'home.plays': '{n} plays',
  'home.themesCount': '{n} tracks', 'home.inFav': 'In favorites',
  'lib.title': 'Your library', 'lib.sub': 'Saved on this device. Logging in with Supabase will sync it to the cloud.',
  'lib.likedPlaylist': 'Playlist', 'lib.likedTitle': 'Liked songs',
  'lib.likedCount': '{n} songs{dur}', 'lib.likedDur': ', {d}',
  'lib.playLiked': 'Play liked songs', 'lib.play': 'Play',
  'lib.emptyLikes': 'Tap the heart on any song to save it here.',
  'lib.sort': 'Sort', 'lib.sortRecent': 'Recently added', 'lib.sortActivity': 'By activity',
  'lib.sortPlays': 'Most plays', 'lib.sortAZ': 'A–Z', 'lib.noFilter': 'Nothing with that filter. Switch genre.',
  'lib.playlists': 'Playlists ({n})', 'lib.playlistNamePh': 'Playlist name…', 'lib.create': 'Create',
  'lib.emptyPl': 'Empty. Go to Home, open “+” on a song and add it here.',
  'lib.delete': 'Delete', 'lib.touch': 'Play', 'lib.enhance': 'Enhance', 'lib.remove': 'Remove',
  'dis.title': 'Discover', 'dis.sub': 'Mixes built from your taste • Nothing leaves your device',
  'dis.djOn': 'Playing your mix. Stopping me stops the music too.',
  'dis.djOff': 'It greets you once, then leaves just the music.',
  'dis.startDj': 'Start DJ', 'dis.stopDj': 'Stop DJ',
  'dis.noVoice': 'Your browser has no voice (Web Speech API). Mixes still work.',
  'dis.building': 'Building your mixes…', 'dis.dailySub': '{n} tracks • refreshes tomorrow',
  'dis.dailyAlt': 'Based on your top genre and favorites', 'dis.todayMix': 'Your mix today',
  'dis.weekly': 'Weekly Discovery', 'dis.weeklyTitle': 'Leave your bubble',
  'dis.weeklySub': 'Exploring: {g}', 'dis.weeklyAlt': 'Genres you barely listen to',
  'dis.daylistAlt': 'Based on your time', 'dis.daylistAltSub': 'Changes with the time of day',
  'dis.nowHour': 'Now playing your hour', 'dis.taste': 'Your Taste Profile',
  'dis.tasteSub': 'Your taste comes from what you play. Excluded tracks don’t affect mixes, DJ or Enhance.',
  'dis.tasteEmpty': 'Play something and your profile shows up on its own.',
  'dis.excluded': 'Excluded ({n})', 'dis.excludedEmpty': 'Tap “Doesn’t count” on a card (+ menu) to exclude it.',
  'dis.backIn': 'Include again', 'dis.foot': 'DJ with local voice (Web Speech API). No accounts or keys.',
  'dis.pauseMix': 'Pause {name}', 'dis.playMix': 'Play {name}',
  'dis.djGreeting': 'Hey! I built this mix from your taste, lots of {g}. Enjoy!',
  'dis.djGreetingAlt': 'Hey! I built this mix from the best of Audius. Enjoy!',
  'pro.profile': 'Profile', 'pro.guest': 'Guest', 'pro.noSession': ' (signed out)',
  'pro.syncHint': 'Log in to sync to the cloud',
  'pro.listened': 'listened', 'pro.playsSub': 'plays ({n} unique tracks)',
  'pro.fav': 'favorites', 'pro.playlistsSub': 'playlists ({n} tracks)',
  'pro.topGenre': 'your top genre', 'pro.design': 'Design', 'pro.accent': 'Accent color',
  'pro.density': 'Card density', 'pro.comfy': 'Comfortable', 'pro.compact': 'Compact',
  'pro.audio': 'Audio', 'pro.crossfade': 'Crossfade (smooth transition between tracks)',
  'pro.radio': 'Infinite radio ∞: the queue never ends, it keeps going with the same vibe',
  'pro.yes': 'Yes', 'pro.no': 'No', 'pro.quality': 'Streaming quality',
  'pro.high': 'High', 'pro.saver': 'Saver',
  'pro.qualityNote': 'Audius only serves compressed audio: High uses the max available. No real FLAC, and we won’t fake it.',
  'pro.djVoice': 'AI DJ voice', 'pro.withVoice': 'With voice', 'pro.musicOnly': 'Music only',
  'pro.language': 'Language / Idioma', 'pro.languageSub': 'All of Sonder in your language. Applies instantly.',
  'pro.region': 'Region', 'pro.regionSub': 'Prioritizes content from your area (Latin, Argentine, etc.).',
  'pro.data': 'Data', 'pro.dataSub': 'Erases favorites, playlists, history and settings on this device. Your account stays intact.',
  'pro.clearData': 'Erase local data',
  'pro.confirmClear': 'Erase your local data (favorites, playlists, history and settings)?',
  'pro.foot': 'Initial: {i} • Stats come from your local listening history.',
  'pro.accentNames': 'Sonder green|Blue|Violet|Orange|Red',
  'pb.choose': 'Pick a song', 'pb.tapAny': 'Tap any card to listen',
  'pb.like': 'Like', 'pb.shuffle': 'Shuffle', 'pb.prev': 'Previous', 'pb.play': 'Play',
  'pb.pause': 'Pause', 'pb.next': 'Next', 'pb.repeat': 'Repeat',
  'pb.repeatTip': 'No repeat|Repeat all|Repeat one',
  'pb.queue': 'Queue', 'pb.progress': 'Progress', 'pb.sleep': 'Sleep timer',
  'pb.sleepTitle': 'Stops in {t} (click to change)',
  'pb.sleepCycle': 'Timer: 15 • 30 • 60 min • off',
  'pb.mute': 'Mute', 'pb.volume': 'Volume', 'pb.close': 'Close', 'pb.details': 'Details',
  'pb.upcoming': 'Playing + {n} next', 'pb.all': 'All', 'pb.removeN': 'Remove ({n})',
  'pb.saveQueue': 'Save queue', 'pb.saved': 'Saved!', 'pb.clear': 'Clear',
  'pb.saveQueueTitle': 'Save the current queue as a playlist in your Library',
  'pb.radioOn': '∞ Radio ON', 'pb.radioOff': '∞ Radio OFF',
  'pb.radioOnTitle': 'Infinite radio on: when it ends it keeps the same vibe (click to turn off)',
  'pb.radioOffTitle': 'Infinite radio off: the queue ends (click to turn on)',
  'pb.nowPlaying': 'Now playing', 'pb.emptyQueue': 'Nothing else in the queue.',
  'pb.noDetail': 'Play something to see its info.', 'pb.loadingDetail': 'Loading info…',
  'pb.noDetailTrack': 'No details for this track.',
  'pb.noDesc': 'No artist description.', 'pb.released': 'Released',
  'pb.key': 'Key', 'pb.mood': 'Mood',
  'pb.tags': 'Tags:', 'pb.viaFull': 'Info via Audius • Lyrics via LRCLIB.',
  'pb.viaLyrics': 'Info unavailable • Lyrics via LRCLIB.',
  'pb.lyricsErr': 'Couldn’t load the lyrics.', 'pb.lyricsMissing': 'No lyrics for this track yet.',
  'pb.synced': 'Synced lyrics', 'pb.lyrics': 'Lyrics', 'pb.karaoke': 'Karaoke',
  'pb.karaokeTitle': 'Fullscreen karaoke (with translation)',
  'pb.preview': '30s preview', 'pb.inLikes': 'In Liked songs', 'pb.addLikes': 'Add to Liked songs',
  'pb.addToPl': 'Add to playlist', 'pb.select': 'Select {t}', 'pb.removeFromQ': 'Remove from queue',
  'pb.trackError': 'That track couldn’t be played.',
  'pb.trackErrorNext': 'That track couldn’t be played, skipping…',
  'pb.stuckNext': 'Connection stalled, skipping…',
  'pb.queueOf': 'Queue of {d}',
  'k.close': 'Close karaoke', 'k.showOriginal': 'Show original', 'k.showEs': 'Show in Spanish',
  'k.translating': 'Translating…', 'k.trError': 'Couldn’t translate (service limit). The original is below.',
  'k.noTime': 'Untimed lyrics: no highlight, but you can read and translate.',
  'k.hint': 'Click a line to jump • Esc to exit',
  'k.noLyrics': 'No lyrics for this track yet.', 'k.of': 'Karaoke of {t}',
  'k.jump': 'Jump to this line',
  'auth.login': 'Log in', 'auth.signup': 'Sign up', 'auth.enter': 'Enter',
  'auth.register': 'Register', 'auth.password': 'Password', 'auth.min6': 'Minimum 6 characters',
  'auth.wait': 'Wait…', 'auth.createdOk': 'Account created. Check your email if Supabase asks for confirmation, then log in.',
  'auth.orContinue': 'or continue with', 'auth.opening': 'Opening…', 'auth.close': 'Close',
  'auth.localMode': 'Local mode: create your free project at supabase.com, copy URL + anon key to a .env file and reload.',
  'auth.noSupabase': 'Supabase not configured (.env). Staying local.',
  'row.play': 'Play {t}', 'row.likedTitle': 'In Liked songs', 'row.addLikesTitle': 'Add to Liked songs',
  'row.createFirst': 'Create a playlist in Library first',
  'row.noInfluence': 'Doesn’t count', 'row.noInfluenceTitle': 'Won’t affect mixes, DJ or Enhance',
  'time.now': 'just now', 'time.min': '{n}m ago', 'time.hour': '{n}h ago',
  'time.day': '{n}d ago', 'time.week': '{n}w ago',
  'time.month': '{n} month|{n} months', 'time.year': '{n} year|{n} years',
  'day.kickoff': '{d} kickoff', 'day.midday': '{d} at midday', 'day.creative': 'Creative {d}',
  'day.sunset': '{d} at sunset', 'day.late': 'Late-night {d}',
  'day.kickoffD': 'Rising energy to start the day.', 'day.middayD': 'High tempo for midday.',
  'day.creativeD': 'Focus and groove for the afternoon.', 'day.sunsetD': 'Winding down in style.',
  'day.lateD': 'Deep sound for the night.',
  'rel.becauseLike': 'Because you like {name}', 'rel.moreLike': 'More {g} like your likes',
  'rel.according': 'Based on your Liked songs.',
  'dj.openers': 'Playing {title}, by {artist}.|Here’s {title} by {artist}.|Up next {title}, by {artist}.',
  'dj.topGenre': 'Matches your week: lots of {g}.', 'dj.genre': 'To open your ears: {g}.',
  'dj.hot': 'Hitting hard on Audius.', 'dj.fresh': 'A fresh discovery for you.',
  'w.title': 'Welcome to Sonder', 'w.sub': 'Where are you from? That sets your language and your music first.',
  'w.latam': 'Latin America', 'w.spain': 'Spain', 'w.brasil': 'Brazil',
  'w.usa': 'USA / English', 'w.other': 'Somewhere else',
  'w.regionLabel': 'Region',
  'w.langLabel': 'App language', 'w.continue': 'Start listening', 'w.skip': 'Not now',
  'w.note': 'You can change it anytime in Your profile.',
  'artist.kicker': 'Original artist', 'artist.follow': 'Follow', 'artist.following': 'Following',
  'artist.followers': 'followers', 'artist.top': 'Top tracks', 'artist.albums': 'Albums ({n})',
  'artist.empty': 'This artist has no playable tracks yet.', 'artist.tracks': '{n} tracks',
  'artist.verified': 'Verified artist', 'artist.originals': 'Originals by this artist', 'artist.versions': 'Versions & remixes ({n})',
  'err.title': 'Something broke', 'err.sub': 'Sonder could not show this screen. You can retry or clear local data and start fresh.',  'err.retry': 'Retry', 'err.reset': 'Clear local data', 'pb.retrying': 'Retrying…',
  'err.detail': 'Technical details', 'k.syncTitle': 'Adjust lyric timing', 'k.syncBack': 'Delay lyrics by 0.5 seconds', 'k.syncFwd': 'Advance lyrics by 0.5 seconds', 'k.syncReset': 'Reset timing to 0',
},
}

// Listas separadas por | (openers del DJ, nombres de acento, mes/año)
export function tList(key) {
  const s = t(key)
  return typeof s === 'string' && s.includes('|') ? s.split('|') : [s]
}
