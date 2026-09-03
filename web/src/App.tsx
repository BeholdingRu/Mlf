import { AuthProvider, useAuth } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import { supabaseConfigured } from './lib/supabase'
import { AuthPage } from './pages/AuthPage'
import { CabinetPage } from './pages/CabinetPage'
import { RecoveryPasswordPage } from './pages/RecoveryPasswordPage'

export default function App() {
  if (!supabaseConfigured) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <p className="eyebrow">MLF</p>
          <h1>Нужен Supabase</h1>
          <p className="lede">
            Скопируйте <code>web/.env.example</code> в <code>web/.env</code> и укажите URL проекта
            и anon-ключ. Затем выполните SQL из <code>web/supabase/schema.sql</code>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  )
}

function Root() {
  const { user, loading, recoveryRequired } = useAuth()
  if (loading) {
    return (
      <div className="auth-shell">
        <p className="muted">Загрузка…</p>
      </div>
    )
  }
  if (!user) return <AuthPage />
  if (recoveryRequired) return <RecoveryPasswordPage />
  return (
    <DataProvider>
      <CabinetPage />
    </DataProvider>
  )
}
