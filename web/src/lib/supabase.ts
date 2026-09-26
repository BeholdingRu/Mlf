import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigured = Boolean(url && anonKey)

let supabase: SupabaseClient | null = null
let publicSupabase: SupabaseClient | null = null
let supabaseAuthPaused = false

export function requireSupabase(): SupabaseClient {
  if (!supabaseConfigured) {
    throw new Error('Supabase не настроен. Заполните файл .env')
  }

  if (!supabase) {
    supabase = createClient(url!, anonKey!)
  }

  return supabase
}

export function requirePublicSupabase(): SupabaseClient {
  if (!supabaseConfigured) {
    throw new Error('Supabase не настроен. Заполните файл .env')
  }

  if (!publicSupabase) {
    publicSupabase = createClient(url!, anonKey!, {
      auth: {
        storageKey: 'mlf-public-content',
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  }

  return publicSupabase
}

export function pauseSupabaseAuth() {
  if (!supabase) return
  supabase.auth.stopAutoRefresh()
  supabaseAuthPaused = true
}

export function resumeSupabaseAuth() {
  if (!supabase || !supabaseAuthPaused) return
  supabase.auth.startAutoRefresh()
  supabaseAuthPaused = false
}
