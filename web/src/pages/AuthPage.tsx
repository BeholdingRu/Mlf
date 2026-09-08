import { useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../hooks/useAuth'
import { getAuthErrorMessage } from '../lib/auth-errors'

type Mode = 'login' | 'register' | 'recovery'
type RecoveryStep = 'email' | 'code'
type RegistrationCodeStatus = 'idle' | 'checking' | 'valid' | 'invalid'
const RECOVERY_CODE_LENGTH = 8

export function AuthPage() {
  const { signIn, signUp, validateRegistrationCode, requestRecovery, verifyRecovery } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [registrationCode, setRegistrationCode] = useState('')
  const [registrationCodeStatus, setRegistrationCodeStatus] = useState<RegistrationCodeStatus>('idle')
  const [alphaTestConsent, setAlphaTestConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [recoveryStep, setRecoveryStep] = useState<RecoveryStep>('email')
  const [code, setCode] = useState<string[]>(Array(RECOVERY_CODE_LENGTH).fill(''))
  const codeRefs = useRef<Array<HTMLInputElement | null>>([])

  function selectMode(nextMode: Mode) {
    setMode(nextMode)
    setError(null)
    setInfo(null)
    if (nextMode !== 'register') {
      setRegistrationCodeStatus('idle')
      setAlphaTestConsent(false)
    }
  }

  async function checkRegistrationCode() {
    const code = registrationCode.trim()
    if (!code) {
      setRegistrationCodeStatus('idle')
      return false
    }

    setRegistrationCodeStatus('checking')
    try {
      const valid = await validateRegistrationCode(code)
      setRegistrationCodeStatus(valid ? 'valid' : 'invalid')
      if (!valid) setAlphaTestConsent(false)
      return valid
    } catch {
      setRegistrationCodeStatus('idle')
      throw new Error('Не удалось проверить код регистрации. Попробуйте ещё раз.')
    }
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
      if (mode === 'register') {
        if (password.length < 6) {
          throw new Error('Пароль должен содержать минимум 6 символов')
        }
        if (password !== password2) {
          throw new Error('Пароли не совпадают')
        }
        const codeIsValid = registrationCodeStatus === 'valid' || await checkRegistrationCode()
        if (!codeIsValid) {
          throw new Error('Введите действующий код регистрации.')
        }
        if (!alphaTestConsent) {
          throw new Error('Подтвердите согласие на участие в альфа-тестировании.')
        }
        const result = await signUp(email.trim(), password, registrationCode)
        if (result === 'confirm') {
          setInfo('Письмо с подтверждением отправлено. После подтверждения войдите в кабинет.')
        }
        return
      }
      if (recoveryStep === 'email') {
        await requestRecovery(email.trim())
        setRecoveryStep('code')
        setInfo('Код из 8 цифр отправлен на почту.')
        return
      }
      if (recoveryStep === 'code') {
        const token = code.join('')
        if (!/^\d{8}$/.test(token)) {
          throw new Error('Введите 8-значный код из письма')
        }
        await verifyRecovery(email.trim(), token)
        return
      }
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
    const next = Array(RECOVERY_CODE_LENGTH).fill('')
    digits.forEach((d, i) => {
      next[i] = d
    })
    setCode(next)
    const focusAt = Math.min(digits.length, RECOVERY_CODE_LENGTH - 1)
    codeRefs.current[focusAt]?.focus()
  }

  const title =
    mode === 'login'
      ? 'Вход'
      : mode === 'register'
        ? 'Регистрация'
        : 'Восстановление пароля'

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <p className="eyebrow">MLF</p>
        <h1>{title}</h1>
        <p className="lede">
          Личный кабинет для ежедневных задач, привычек и прогресса по дням.
        </p>
        <form onSubmit={onSubmit}>
          {(mode !== 'recovery' || recoveryStep === 'email') && (
            <label>
              Email
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          )}

          {mode === 'recovery' && recoveryStep === 'code' && (
            <div className="code-block">
              <span>Код из письма</span>
              <div className="code-row">
                {code.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      codeRefs.current[index] = el
                    }}
                    className="code-cell"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => onCodeChange(index, e.target.value)}
                    onKeyDown={(e) => onCodeKeyDown(index, e.key)}
                    onPaste={(e) => {
                      e.preventDefault()
                      onCodePaste(e.clipboardData.getData('text'))
                    }}
                    aria-label={`Цифра ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          )}

          {(mode === 'login' || mode === 'register') && (
            <label>
              Пароль
              <input
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}

          {mode === 'register' && (
            <>
              <label>
                Повторите пароль
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                />
              </label>
              <label>
                Код регистрации
                <input
                  type="text"
                  autoComplete="off"
                  required
                  value={registrationCode}
                  onChange={(e) => {
                    setRegistrationCode(e.target.value)
                    setRegistrationCodeStatus('idle')
                    setAlphaTestConsent(false)
                  }}
                  onBlur={() => {
                    void checkRegistrationCode().catch((err: unknown) => {
                      setError(getAuthErrorMessage(err, 'Не удалось проверить код регистрации'))
                    })
                  }}
                />
                {registrationCodeStatus === 'checking' && <span className="hint">Проверяем код…</span>}
                {registrationCodeStatus === 'invalid' && <span className="field-error">Код регистрации неверный.</span>}
              </label>
              {registrationCodeStatus === 'valid' && (
                <label className="consent-check">
                  <input
                    type="checkbox"
                    checked={alphaTestConsent}
                    onChange={(e) => setAlphaTestConsent(e.target.checked)}
                  />
                  <span>
                    Вы регистрируетесь на альфа-тест проекта MLF, все данные, которые вы введёте,
                    могут и будут использоваться разработчиком в целях тестирования.
                  </span>
                </label>
              )}
            </>
          )}

          {error && <p className="banner error">{error}</p>}
          {info && <p className="banner info">{info}</p>}

          <button className="primary" type="submit" disabled={busy}>
            {busy
              ? 'Подождите…'
              : mode === 'login'
                ? 'Войти'
                : mode === 'register'
                  ? 'Создать аккаунт'
                  : recoveryStep === 'email'
                    ? 'Отправить код'
                    : recoveryStep === 'code'
                      ? 'Подтвердить код'
                      : 'Сохранить пароль'}
          </button>
        </form>

        <div className="auth-links">
          {mode !== 'login' && (
            <button type="button" className="link" onClick={() => selectMode('login')}>
              Уже есть аккаунт? Войти
            </button>
          )}
          {mode !== 'register' && (
            <button type="button" className="link" onClick={() => selectMode('register')}>
              Нет аккаунта? Регистрация
            </button>
          )}
          {mode === 'login' && (
            <button
              type="button"
              className="link"
              onClick={() => {
                selectMode('recovery')
                setRecoveryStep('email')
              }}
            >
              Забыли пароль?
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
