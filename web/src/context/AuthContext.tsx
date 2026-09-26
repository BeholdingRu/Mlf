import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  pauseSupabaseAuth,
  requireSupabase,
  resumeSupabaseAuth,
  supabaseConfigured,
} from '../lib/supabase'
import { AuthContext, type AuthContextValue } from './auth-context'
const RECOVERY_REQUIRED_STORAGE_KEY = 'mlf:recovery-password-required'
const GUEST_MODE_STORAGE_KEY = 'mlf:guest-mode'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isGuest, setIsGuest] = useState(
    () => window.localStorage.getItem(GUEST_MODE_STORAGE_KEY) === 'true',
  )
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(() => !isGuest && supabaseConfigured)
  const [recoveryRequired, setRecoveryRequired] = useState(
    () => window.sessionStorage.getItem(RECOVERY_REQUIRED_STORAGE_KEY) === 'true',
  )

  useEffect(() => {
    if (isGuest || !supabaseConfigured) {
      return
    }

    let active = true
    const client = requireSupabase()
    resumeSupabaseAuth()
    client.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = client.auth.onAuthStateChange((event, next) => {
      if (!active) return
      setSession(next)
      if (event === 'PASSWORD_RECOVERY') {
        window.sessionStorage.setItem(RECOVERY_REQUIRED_STORAGE_KEY, 'true')
        setRecoveryRequired(true)
      }
      if (event === 'SIGNED_OUT') {
        window.sessionStorage.removeItem(RECOVERY_REQUIRED_STORAGE_KEY)
        setRecoveryRequired(false)
      }
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [isGuest])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      isGuest,
      recoveryRequired,
      enterGuestMode() {
        pauseSupabaseAuth()
        window.localStorage.setItem(GUEST_MODE_STORAGE_KEY, 'true')
        setSession(null)
        setLoading(false)
        setIsGuest(true)
      },
      exitGuestMode() {
        window.localStorage.removeItem(GUEST_MODE_STORAGE_KEY)
        setLoading(supabaseConfigured)
        setIsGuest(false)
      },
      async signIn(email, password) {
        const { error } = await requireSupabase().auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
      },
      async validateRegistrationCode(code) {
        const { data, error } = await requireSupabase().rpc('is_valid_registration_code', {
          candidate_code: code.trim(),
        })
        if (error) throw error
        return data === true
      },
      async signUp(email, password, registrationCode) {
        const { data, error } = await requireSupabase().auth.signUp({
          email,
          password,
          options: {
            data: {
              registration_code: registrationCode.trim(),
              alpha_test_consent: true,
            },
          },
        })
        if (error) throw error
        return data.session ? 'session' : 'confirm'
      },
      async signOut() {
        const { error } = await requireSupabase().auth.signOut()
        if (error) throw error
      },
      async requestRecovery(email) {
        const { error } = await requireSupabase().auth.resetPasswordForEmail(email)
        if (error) throw error
      },
      async verifyRecovery(email, token) {
        const { error } = await requireSupabase().auth.verifyOtp({
          email,
          token,
          type: 'recovery',
        })
        if (error) throw error
        window.sessionStorage.setItem(RECOVERY_REQUIRED_STORAGE_KEY, 'true')
        setRecoveryRequired(true)
      },
      async updatePassword(password) {
        const client = requireSupabase()
        const { error } = await client.auth.updateUser({ password })
        if (error) throw error
        const { error: signOutError } = await client.auth.signOut({ scope: 'others' })
        if (signOutError) throw signOutError
        window.sessionStorage.removeItem(RECOVERY_REQUIRED_STORAGE_KEY)
        setRecoveryRequired(false)
      },
      async changePassword(currentPassword, newPassword) {
        const email = session?.user.email
        if (!email) throw new Error('Не удалось определить email текущего пользователя')

        const client = requireSupabase()
        const { error: signInError } = await client.auth.signInWithPassword({
          email,
          password: currentPassword,
        })
        if (signInError) throw new Error('Текущий пароль указан неверно')

        const { error } = await client.auth.updateUser({
          password: newPassword,
          current_password: currentPassword,
        })
        if (error) throw error
        const { error: signOutError } = await client.auth.signOut({ scope: 'others' })
        if (signOutError) throw signOutError
      },
      async verifyPassword(password) {
        const email = session?.user.email
        if (!email) throw new Error('Не удалось определить email текущего пользователя')
        const { error } = await requireSupabase().auth.signInWithPassword({ email, password })
        if (error) throw new Error('Пароль указан неверно')
      },
    }),
    [session, loading, isGuest, recoveryRequired],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
