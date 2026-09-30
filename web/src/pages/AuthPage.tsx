import { useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../hooks/useAuth'
import { getAuthErrorMessage } from '../lib/auth-errors'

type AuthMode = 'login' | 'recovery'
type RecoveryStep = 'email' | 'code'

const RECOVERY_CODE_LENGTH = 8

export function AuthPage() {
  const { signIn, requestRecovery, verifyRecovery } = useAuth()
  const [mode, setMode] = useState<AuthMode>('login')
  const [recoveryStep, setRecoveryStep] = useState<RecoveryStep>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState<string[]>(Array(RECOVERY_CODE_LENGTH).fill(''))
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const codeRefs = useRef<Array<HTMLInputElement | null>>([])

  function selectMode(nextMode: AuthMode) {
    setMode(nextMode)
    setRecoveryStep('email')
    setCode(Array(RECOVERY_CODE_LENGTH).fill(''))
    setError(null)
    setInfo(null)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setInfo(null)
    setBusy(true)

    try {
      if (mode === 'login') {
        await signIn(email.trim(), password)
        return
      }

      if (recoveryStep === 'email') {
        await requestRecovery(email.trim())
        setRecoveryStep('code')
        setInfo('Код из 8 цифр отправлен на почту.')
        return
      }

      const token = code.join('')
      if (!/^\d{8}$/.test(token)) {
        throw new Error('Введите 8-значный код из письма')
      }
      await verifyRecovery(email.trim(), token)
    } catch (err) {
      setError(getAuthErrorMessage(err, 'Не удалось выполнить запрос'))
    } finally {
      setBusy(false)
    }
  }

  function onCodeChange(index: number, raw: string) {
    const digit = raw.replace(/\D/g, '').slice(-1)
    const next = [...code]
    next[index] = digit
    setCode(next)
    if (digit && index < RECOVERY_CODE_LENGTH - 1) {
      codeRefs.current[index + 1]?.focus()
    }
  }

  function onCodeKeyDown(index: number, key: string) {
    if (key === 'Backspace' && !code[index] && index > 0) {
      codeRefs.current[index - 1]?.focus()
    }
  }

  function onCodePaste(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, RECOVERY_CODE_LENGTH).split('')
    if (!digits.length) return

    const next = Array<string>(RECOVERY_CODE_LENGTH).fill('')
    digits.forEach((digit, index) => {
      next[index] = digit
    })
    setCode(next)
    codeRefs.current[Math.min(digits.length, RECOVERY_CODE_LENGTH - 1)]?.focus()
  }

  const recoveryCodeStep = mode === 'recovery' && recoveryStep === 'code'

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <p className="eyebrow">MLF</p>
        <h1>{mode === 'login' ? 'Вход' : 'Восстановление пароля'}</h1>
        <p className="lede">
          {mode === 'login'
            ? 'Личный кабинет для ежедневных задач, привычек и прогресса по дням.'
            : recoveryCodeStep
              ? `Введите код, отправленный на ${email.trim()}.`
              : 'Укажите email, который используется для входа в личный кабинет.'}
        </p>
        <form onSubmit={onSubmit}>
          {!recoveryCodeStep && (
            <label>
              {mode === 'login' ? 'Логин' : 'Email'}
              <input
                type="email"
                autoComplete={mode === 'login' ? 'username' : 'email'}
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
          )}

          {mode === 'login' && (
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
          )}

          {recoveryCodeStep && (
            <div className="code-block">
              <span>Код из письма</span>
              <div className="code-row">
                {code.map((digit, index) => (
                  <input
                    key={index}
                    ref={(element) => {
                      codeRefs.current[index] = element
                    }}
                    className="code-cell"
                    type="text"
                    inputMode="numeric"
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    maxLength={1}
                    value={digit}
                    onChange={(event) => onCodeChange(index, event.target.value)}
                    onKeyDown={(event) => onCodeKeyDown(index, event.key)}
                    onPaste={(event) => {
                      event.preventDefault()
                      onCodePaste(event.clipboardData.getData('text'))
                    }}
                    aria-label={`Цифра ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          )}

          {error && <p className="banner error">{error}</p>}
          {info && <p className="banner info">{info}</p>}

          <button className="primary" type="submit" disabled={busy}>
            {busy
              ? 'Подождите…'
              : mode === 'login'
                ? 'Войти'
                : recoveryStep === 'email'
                  ? 'Отправить код'
                  : 'Подтвердить код'}
          </button>
        </form>

        <div className="auth-links">
          {mode === 'login' ? (
            <button type="button" className="link" onClick={() => selectMode('recovery')}>
              Забыли пароль?
            </button>
          ) : (
            <button type="button" className="link" onClick={() => selectMode('login')}>
              Вернуться ко входу
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
