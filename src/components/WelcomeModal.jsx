import { useState } from 'react'
import { createPortal } from 'react-dom'
import { AudioLines, MapPin, Languages, Play } from 'lucide-react'
import { LANGS, REGIONS, browserLang, detectRegion, t } from '../lib/i18n.js'
import { store } from '../lib/store.js'

const REGION_LANG = { latam: 'es', spain: 'es', brasil: 'es', usa: 'en', other: null }

// Primera vez que entra: ¿de dónde eres? Define idioma + región (contenido).
// Se muestra una sola vez (flag sonder:welcome); se puede cambiar en Perfil.
function WelcomeModal({ onDone }) {
  const [region, setRegion] = useState(() => detectRegion())
  const [lang, setLang] = useState(() => REGION_LANG[detectRegion()] || browserLang())
  const pickRegion = (r) => {
    setRegion(r)
    if (REGION_LANG[r]) setLang(REGION_LANG[r])
  }
  const finish = (skip) => {
    const prev = store.settings
    store.settings = {
      ...prev,
      lang: skip ? browserLang() : lang,
      region: skip ? detectRegion() : region,
    }
    try {
      document.documentElement.lang = store.settings.lang
      localStorage.setItem('sonder:welcome', '1')
    } catch {}
    onDone()
    // Recarga para que mixes/etiquetas generadas nazcan en tu idioma
    try { window.location.reload() } catch {}
  }

  return createPortal(
    <div className="modal-backdrop welcome" onClick={() => finish(true)}>
      <div className="modal welcome-modal" onClick={(e) => e.stopPropagation()}>
        <p className="logo"><span className="logo-icon"><AudioLines size={22} strokeWidth={2.5} /></span><span>Sonder</span></p>
        <h2>{t('w.title')}</h2>
        <p className="muted">{t('w.sub')}</p>
        <p className="w-label"><MapPin size={14} /> {t('w.regionLabel')}</p>
        <div className="w-grid">
          {REGIONS.map((r) => (
            <button key={r} className={region === r ? 'chip active' : 'chip'} onClick={() => pickRegion(r)}>
              {t(`w.${r}`)}
            </button>
          ))}
        </div>
        <p className="w-label"><Languages size={14} /> {t('w.langLabel')}</p>
        <div className="segmented">
          {Object.entries(LANGS).map(([k, name]) => (
            <button key={k} className={lang === k ? 'seg active' : 'seg'} onClick={() => setLang(k)}>{name}</button>
          ))}
        </div>
        <button className="action-btn full" onClick={() => finish(false)}>
          <Play size={16} /> {t('w.continue')}
        </button>
        <button className="link-chip w-skip" onClick={() => finish(true)}>{t('w.skip')}</button>
        <p className="muted foot">{t('w.note')}</p>
      </div>
    </div>,
    document.body
  )
}

export function shouldWelcome() {
  try {
    if (localStorage.getItem('sonder:welcome')) return false
    return !store.settings.lang // usuarios viejos sin idioma también lo ven una vez
  } catch { return false }
}

export default WelcomeModal
