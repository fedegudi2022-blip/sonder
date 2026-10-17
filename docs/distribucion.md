# Distribución: .exe auto-actualizable + landing en Vercel

## 1. Una sola vez (en tu PC con Windows)

1. **Instala Rust** (lo pide Tauri): https://rustup.rs → `rustup-init.exe`, acepta todo.
2. **Instala dependencias nuevas:**
   ```powershell
   npm install
   ```
   (agrega `@tauri-apps/plugin-updater` y `@tauri-apps/plugin-process`, ya listados en `package.json`)
3. **Genera tu clave de firma** (el .exe solo acepta updates firmados por ti):
   ```powershell
   npm run tauri signer generate -w "$HOME\.tauri\sonder.key"
   ```
   Te pide contraseña: **guárdala** (la necesitarás en cada release). Te imprime una `pubkey`.
4. **Pega la pubkey** en `src-tauri/tauri.conf.json` donde dice `PON_AQUI_TU_PUBKEY_TAURI`.
5. **Repo en GitHub**: `fedegudi2022-blip/sonder` (ya creado y conectado en
   `src-tauri/tauri.conf.json` → `plugins.updater.endpoints` y `landing/app.js` → `CONFIG.repo`).
6. ⚠️ El identificador quedó fijo en `com.sonder.app`. **No lo cambies nunca**: es lo que
   permite que el .exe reconozca sus propias actualizaciones.

## 2. Publicar una versión (cada vez que agregues cosas)

1. **Sube versión** en estos 3 archivos (los 3 con el mismo número, p. ej. `0.2.0`):
   - `package.json` → `version`
   - `src-tauri/tauri.conf.json` → `version`
   - `src-tauri/Cargo.toml` → `version`
   - y `landing/app.js` → `CONFIG.version` (lo que muestra la web)
2. **Compila el .exe:**
   ```powershell
   $env:TAURI_SIGNING_PRIVATE_KEY = (Get-Content "$HOME\.tauri\sonder.key" -Raw)
   $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "TU_CONTRASEÑA"
   npm run tauri:build
   ```
   Salen (en `src-tauri/target/release/bundle/`):
   - `nsis/Sonder_0.2.0_x64-setup.exe` → el instalador
   - `nsis/Sonder_0.2.0_x64-setup.exe.sig` → su firma
   - `updater/latest.json` → el archivo que la app consulta (¡ya apunta a tu GitHub!)
3. **Crea el Release en GitHub** con tag `v0.2.0` y sube esos 3 archivos
   (el `.exe`, el `.sig` y el `latest.json`). El `latest.json` debe quedar descargable en
   `.../releases/latest/download/latest.json`.
4. **Listo:** los usuarios con el .exe verán el aviso y se actualizan desde
   Perfil → *Buscar actualizaciones*. El botón Descargar de la landing apunta siempre
   a `/releases/latest`, así que no hay que tocar nada más.

## 3. Landing en Vercel (una sola vez)

La carpeta `landing/` es un sitio estático sin build (HTML + CSS + JS puro).

1. Entra a https://vercel.com → **Add New → Project** → importa tu repo de GitHub.
2. En **Configure Project → Root Directory**: escribe `landing` (¡importante!).
3. **Build & Output Settings**: deja todo vacío (no hay comando de build).
4. **Deploy**. Te da una URL tipo `sonder.vercel.app`.
5. Cada vez que cambies la landing o `CONFIG.version`, haz push al repo: Vercel
   redespliega solo en segundos.

## 4. Probar el updater antes de publicar

1. Compila e instala la `0.1.0` local (`npm run tauri:build` → instala el `.exe`).
2. Sube versión a `0.1.1`, compila y crea un **Release de prueba** en GitHub.
3. Abre la app instalada → Perfil → *Buscar actualizaciones*: debe descargar,
   instalar y reiniciarse en la `0.1.1`.
