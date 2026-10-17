import { createClient } from '@supabase/supabase-js'

// Lee claves públicas desde .env (VITE_ = visibles en el navegador, es normal).
// Si no hay claves, la app sigue en modo local sin romper nada.
const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigured = Boolean(url && anon)

export const supabase = supabaseConfigured
  ? createClient(url, anon)
  : null
