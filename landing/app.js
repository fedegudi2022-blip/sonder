// ═══ CONFIGURACIÓN: edita estas 2 líneas en cada release ═══
const CONFIG = {
  repo: 'TU_USUARIO/sonder', // ← tu repo de GitHub (para el botón Descargar)
  version: '0.1.0',          // ← misma versión que package.json y tauri.conf.json
}
// ════════════════════════════════════════════════════════════

const releaseUrl = `https://github.com/${CONFIG.repo}/releases/latest`
document.querySelectorAll('a.dl-link').forEach((a) => {
  a.href = releaseUrl
  a.target = '_blank'
  a.rel = 'noopener'
})
document.querySelectorAll('#ver, #ver2').forEach((el) => { el.textContent = CONFIG.version })
document.querySelectorAll('.ver').forEach((el) => { el.textContent = CONFIG.version })
document.getElementById('year').textContent = new Date().getFullYear()
