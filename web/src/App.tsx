import { AuthProvider } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import { useAuth } from './hooks/useAuth'
import { AuthPage } from './pages/AuthPage'
import { CabinetPage } from './pages/CabinetPage'
import { RecoveryPasswordPage } from './pages/RecoveryPasswordPage'

export default function App() {
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
        <div className="auth-card auth-loading-card">
          <p className="muted">Загрузка…</p>
        </div>
      </div>
    )
  }
  if (!user) return <AuthPage />
  if (recoveryRequired) return <RecoveryPasswordPage />
  return (
    <DataProvider key={user.id}>
      <CabinetPage />
    </DataProvider>
  )
}
