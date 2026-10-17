import { House, Search, Library, AudioLines, BadgeCheck, Heart, ListMusic, Disc3, CircleUserRound, Sparkles } from 'lucide-react'
import { useLibrary } from '../context/LibraryContext.jsx'
import { usePlayer } from '../context/PlayerContext.jsx'
import { useT } from '../lib/i18n.js'

function Sidebar({ vista, setVista }) {
  const { likes, playlists } = useLibrary()
  const { current, isPlaying } = usePlayer()
  const { t } = useT()

  const go = (v) => setVista(v)

  return (
    <nav className="sidebar">
      <div className="logo">
        <span className="logo-icon"><AudioLines size={22} strokeWidth={2.5} /></span>
        <span>Sonder</span>
      </div>

      <button className={vista === 'inicio' ? 'nav-btn active' : 'nav-btn'} onClick={() => go('inicio')}>
        <House size={20} />
        <span>{t('nav.home')}</span>
      </button>

      <button className={vista === 'buscar' ? 'nav-btn active' : 'nav-btn'} onClick={() => go('buscar')}>
        <Search size={20} />
        <span>{t('nav.search')}</span>
      </button>

      <button className={vista === 'descubrir' ? 'nav-btn active' : 'nav-btn'} onClick={() => go('descubrir')}>
        <Sparkles size={20} />
        <span>{t('nav.discover')}</span>
      </button>      <button
        className={vista === 'perfil' ? 'nav-btn active' : 'nav-btn'}
        onClick={() => go('perfil')}
      >
        <CircleUserRound size={20} />
        <span>{t('nav.profile')}</span>
      </button>

      <button
        className={vista === 'biblioteca' ? 'nav-btn active' : 'nav-btn'}
        onClick={() => go('biblioteca')}
      >
        <Library size={20} />
        <span>{t('nav.library')}</span>
        {(likes.length + playlists.length) > 0 && (
          <span className="nav-badge">{likes.length + playlists.reduce((a, p) => a + p.trackIds.length, 0)}</span>
        )}
      </button>

      <div className="side-section">
        <p className="side-title"><ListMusic size={14} /> {t('nav.playlists')}</p>
        {playlists.length === 0
          ? <p className="side-empty">{t('nav.firstPlaylist')}</p>
          : playlists.slice(0, 4).map((p) => (
            <button key={p.id} className="side-item" onClick={() => go('biblioteca')}>
              <Disc3 size={16} />
              <span className="side-item-name">{p.name}</span>
              <span className="side-count">{p.trackIds.length}</span>
            </button>
          ))}
        <p className="side-item static"><Heart size={16} /><span className="side-item-name">{t('nav.liked')}</span><span className="side-count">{likes.length}</span></p>
      </div>

      {current && (
        <div className="now-playing">
          <div className="np-cover">{current.artwork ? <img src={current.artwork} alt="" /> : <AudioLines size={16} />}</div>
          <div className="np-meta">
            <strong>{current.title}</strong>
            <small>{isPlaying ? t('nav.nowPlaying') : t('nav.paused')} • {current.artist}</small>
          </div>
          {isPlaying && <span className="np-dot" />}
        </div>
      )}

      <div className="sidebar-note">
        <p><BadgeCheck size={16} /> {t('nav.legal')}</p>
        <small>{t('nav.legalSub')}</small>
      </div>
    </nav>
  )
}

export default Sidebar
