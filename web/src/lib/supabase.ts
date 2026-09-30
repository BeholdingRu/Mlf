import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigured = Boolean(url && anonKey)

let supabase: SupabaseClient | null = null

export function requireSupabase(): SupabaseClient {
  if (!supabaseConfigured) {
    throw new Error('Supabase не настроен. Заполните файл .env')
  }

  if (!supabase) {
    supabase = createClient(url!, anonKey!)
  }

  return supabase
}
