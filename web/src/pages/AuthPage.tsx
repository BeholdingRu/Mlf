import { useState, type FormEvent } from 'react'
import { useAuth } from '../hooks/useAuth'
import { getAuthErrorMessage } from '../lib/auth-errors'

export function AuthPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)

    try {
      await signIn(email.trim(), password)
    } catch (err) {
      setError(getAuthErrorMessage(err, 'Не удалось выполнить вход'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <p className="eyebrow">MLF</p>
        <h1>Вход</h1>
        <p className="lede">
          Личный кабинет для ежедневных задач, привычек и прогресса по дням.
        </p>
        <form onSubmit={onSubmit}>
          <label>
            Логин
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label>
            Пароль
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {error && <p className="banner error">{error}</p>}

          <button className="primary" type="submit" disabled={busy}>
            {busy ? 'Подождите…' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  )
}
