import { useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
import Header from './components/Header.jsx'
import PlayerBar from './components/PlayerBar.jsx'
import AuthModal from './components/AuthModal.jsx'
import WelcomeModal, { shouldWelcome } from './components/WelcomeModal.jsx'
import ArtistView from './components/ArtistView.jsx'
import PlaylistView from './components/PlaylistView.jsx'
import Home from './pages/Home.jsx'
import Profile from './pages/Profile.jsx'
import Discover from './pages/Discover.jsx'
import { PlayerProvider } from './context/PlayerContext.jsx'
import { LibraryProvider } from './context/LibraryContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'

function App() {
  const [vista, setVista] = useState('inicio')
  const [busqueda, setBusqueda] = useState('')
  const [showAuth, setShowAuth] = useState(false)
  const [welcome, setWelcome] = useState(() => shouldWelcome())

  return (
    <AuthProvider>
      <PlayerProvider>
        <LibraryProvider>
          <div className="spotify">
            <div className="top">
              <Sidebar vista={vista} setVista={setVista} />
              <div className="main-col">
                <Header busqueda={busqueda} setBusqueda={setBusqueda} onLogin={() => setShowAuth(true)} onProfile={() => setVista('perfil')} />
                {vista === 'perfil' ? <Profile /> : vista === 'descubrir' ? <Discover /> : <Home vista={vista} busqueda={busqueda} setBusqueda={setBusqueda} />}
              </div>
            </div>
            <PlayerBar />
            <ArtistView />
            <PlaylistView />
            {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
            {welcome && <WelcomeModal onDone={() => setWelcome(false)} />}
          </div>
        </LibraryProvider>
      </PlayerProvider>
    </AuthProvider>
  )
}

export default App
