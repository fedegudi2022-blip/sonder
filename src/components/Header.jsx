import { Search, CircleUserRound, X, LogOut } from 'lucide-react'
import { store } from '../lib/store.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useT } from '../lib/i18n.js'

function Header({ busqueda, setBusqueda, onLogin, onProfile }) {
  const { user, signOut } = useAuth()
  const { t } = useT()

  const commitSearch = () => {
    const q = busqueda.trim()
    if (!q) return
    const prev = store.searches.filter((s) => s.toLowerCase() !== q.toLowerCase())
    store.searches = [q, ...prev]
  }

  return (
    <header className="header">
      <div className="search-wrap">
        <Search size={18} className="search-icon" />
        <input
          className="search with-icon"
          type="text"
          spellCheck={false}
          autoComplete="off"
          placeholder={t('header.searchPh')}
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commitSearch() }}
          onBlur={commitSearch}
        />
        {busqueda && (
          <button className="clear-btn" onClick={() => setBusqueda('')} aria-label={t('header.clear')}>
            <X size={16} />
          </button>
        )}
      </div>
      {user ? (
        <div className="user-box">
          <button className="user-email" title={user.email} onClick={onProfile}> {user.email}</button>
          <button className="icon-btn" onClick={signOut} aria-label={t('header.logout')}><LogOut size={16} /> {t('header.logout')}</button>
        </div>
      ) : (
        <button className="login-btn" onClick={onLogin}>
          <CircleUserRound size={18} />
          <span>{t('header.login')}</span>
        </button>
      )}
    </header>
  )
}

export default Header
