import React from 'react'
import { t } from '../lib/i18n.js'

// Red de seguridad: si el render revienta por cualquier motivo (datos locales
// corruptos, respuesta inesperada de la API…), muestra esto en vez de dejar
// la página negra. "Borrar datos" limpia las claves sonder:* y recarga.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    try { console.error('[Sonder]', error, info?.componentStack || '') } catch {}
    this.setState({ info })
  }

  retry = () => this.setState({ error: null })

  reset = () => {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('sonder:'))
        .forEach((k) => localStorage.removeItem(k))
    } catch {}
    location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="error-page" role="alert">
        <h2>{t('err.title')}</h2>
        <p className="muted">{t('err.sub')}</p>
        <div className="error-actions">
          <button className="login-btn" onClick={this.retry}>{t('err.retry')}</button>
          <button className="icon-btn" onClick={this.reset}>{t('err.reset')}</button>
        </div>
        <details className="error-detail">
          <summary>{t('err.detail')}</summary>
          <pre>{String(this.state.error?.message || this.state.error || '')}</pre>
          {this.state.info ? <pre>{String(this.state.info.componentStack || '').split('\n').slice(0, 6).join('\n')}</pre> : null}
        </details>
      </div>
    )
  }
}

export default ErrorBoundary
