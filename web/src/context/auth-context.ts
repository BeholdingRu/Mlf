import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export type AuthContextValue = {
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

export const AuthContext = createContext<AuthContextValue | null>(null)
