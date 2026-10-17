// Actualizaciones automáticas del .exe (Tauri updater).
// En la versión web los plugins no existen: se detecta y se avisa sin romper nada.
let modsPromise = null

function loadMods() {
  if (!modsPromise) {
    modsPromise = Promise.all([
      import('@tauri-apps/plugin-updater'),
      import('@tauri-apps/plugin-process'),
    ]).then(([updater, appProcess]) => ({ updater, appProcess })).catch(() => null)
  }
  return modsPromise
}

export async function isDesktopApp() {
  return !!(await loadMods())
}

// onEvent: {type:'started'|'progress'|'finished', downloaded, total}
// Si hay update, lo instala y reinicia la app (no hace falta estado 'listo').
export async function checkForAppUpdates(onEvent) {
  const mods = await loadMods()
  if (!mods) return { supported: false }
  const update = await mods.updater.check()
  if (!update) return { supported: true, available: false }
  let downloaded = 0
  let total = 0
  await update.downloadAndInstall((e) => {
    if (e.event === 'Started') {
      total = e.data.contentLength || 0
      onEvent?.({ type: 'started', downloaded: 0, total })
    } else if (e.event === 'Progress') {
      downloaded += e.data.chunkLength
      onEvent?.({ type: 'progress', downloaded, total })
    } else if (e.event === 'Finished') {
      onEvent?.({ type: 'finished', downloaded, total })
    }
  })
  await mods.appProcess.relaunch()
  return { supported: true, available: true }
}
