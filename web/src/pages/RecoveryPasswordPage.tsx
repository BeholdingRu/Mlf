import { useState, type FormEvent } from 'react'
import { useAuth } from '../hooks/useAuth'
import { getAuthErrorMessage } from '../lib/auth-errors'

export function RecoveryPasswordPage() {
  const { updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('Пароль должен содержать минимум 6 символов')
      return
    }
    if (password !== passwordConfirmation) {
      setError('Пароли не совпадают')
      return
    }

    setBusy(true)
    try {
      await updatePassword(password)
    } catch (err) {
      setError(getAuthErrorMessage(err, 'Не удалось сохранить новый пароль'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <p className="eyebrow">MLF</p>
        <h1>Новый пароль</h1>
        <p className="lede">Код подтверждён. Создайте новый пароль для входа в личный кабинет.</p>
        <form onSubmit={onSubmit}>
          <label>
            Новый пароль
            <input
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <label>
            Повторите новый пароль
            <input
              type="password"
              autoComplete="new-password"
              required
              value={passwordConfirmation}
              onChange={(event) => setPasswordConfirmation(event.target.value)}
            />
          </label>
          {error && <p className="banner error">{error}</p>}
          <button className="primary" type="submit" disabled={busy}>
            {busy ? 'Сохранение…' : 'Сохранить пароль'}
          </button>
        </form>
      </div>
    </div>
  )
}
