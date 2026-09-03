import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { requireSupabase, supabaseConfigured } from '../lib/supabase'

type AuthContextValue = {
  user: User | null
  session: Session | null
  loading: boolean
  recoveryRequired: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<'session' | 'confirm'>
  signOut: () => Promise<void>
  requestRecovery: (email: string) => Promise<void>
  verifyRecovery: (email: string, token: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)
const RECOVERY_REQUIRED_STORAGE_KEY = 'mlf:recovery-password-required'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [recoveryRequired, setRecoveryRequired] = useState(
    () => window.sessionStorage.getItem(RECOVERY_REQUIRED_STORAGE_KEY) === 'true',
  )

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false)
      return
    }
    const client = requireSupabase()
    client.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = client.auth.onAuthStateChange((event, next) => {
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
      sub.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      recoveryRequired,
      async signIn(email, password) {
        const { error } = await requireSupabase().auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
      },
      async signUp(email, password) {
        const { data, error } = await requireSupabase().auth.signUp({
          email,
          password,
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
        const { error } = await requireSupabase().auth.updateUser({ password })
        if (error) throw error
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
      },
    }),
    [session, loading, recoveryRequired],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
