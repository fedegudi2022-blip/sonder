import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { applySettings } from './lib/store.js'
import ErrorBoundary from './components/ErrorBoundary.jsx'

// Aplica color y densidad guardados antes del primer render
applySettings()

// Punto de entrada: conecta React con el <div id="root"> del index.html
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
