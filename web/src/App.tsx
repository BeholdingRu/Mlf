import { AuthProvider } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import { GuestDataProvider } from './context/GuestDataProvider'
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
  const { user, loading, isGuest, recoveryRequired, enterGuestMode } = useAuth()
  if (loading) {
    return (
      <div className="auth-shell">
        <div className="auth-card auth-loading-card">
          <p className="muted">Загрузка…</p>
          <button type="button" className="ghost guest-mode-button" onClick={enterGuestMode}>
            Продолжить как гость
          </button>
          <p className="hint">Гостевые данные останутся только в этом браузере.</p>
        </div>
      </div>
    )
  }
  if (isGuest) {
    return (
      <GuestDataProvider key="guest-local">
        <CabinetPage />
      </GuestDataProvider>
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
