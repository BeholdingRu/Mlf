import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'

type Mode = 'login' | 'register' | 'recovery'
type RecoveryStep = 'email' | 'code' | 'password'

export function AuthPage() {
  const { signIn, signUp, requestRecovery, verifyRecovery, updatePassword } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [recoveryStep, setRecoveryStep] = useState<RecoveryStep>('email')
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const codeRefs = useRef<Array<HTMLInputElement | null>>([])

  useEffect(() => {
    setError(null)
    setInfo(null)
  }, [mode])

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
        const result = await signUp(email.trim(), password)
        if (result === 'confirm') {
          setInfo('Письмо с подтверждением отправлено. После подтверждения войдите в кабинет.')
        }
        return
      }
      if (recoveryStep === 'email') {
        await requestRecovery(email.trim())
        setRecoveryStep('code')
        setInfo('Код из 6 цифр отправлен на почту.')
        return
      }
      if (recoveryStep === 'code') {
        const token = code.join('')
        if (!/^\d{6}$/.test(token)) {
          throw new Error('Введите 6-значный код из письма')
        }
        await verifyRecovery(email.trim(), token)
        setRecoveryStep('password')
        setInfo('Код принят. Задайте новый пароль.')
        return
      }
      if (password.length < 6) {
        throw new Error('Пароль должен содержать минимум 6 символов')
      }
      if (password !== password2) {
        throw new Error('Пароли не совпадают')
      }
      await updatePassword(password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось выполнить запрос')
    } finally {
      setBusy(false)
    }
  }

  function onCodeChange(index: number, raw: string) {
    const digit = raw.replace(/\D/g, '').slice(-1)
    const next = [...code]
    next[index] = digit
    setCode(next)
    if (digit && index < 5) {
      codeRefs.current[index + 1]?.focus()
    }
  }

  function onCodeKeyDown(index: number, key: string) {
    if (key === 'Backspace' && !code[index] && index > 0) {
      codeRefs.current[index - 1]?.focus()
    }
  }

  function onCodePaste(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 6).split('')
    if (!digits.length) return
    const next = ['', '', '', '', '', '']
    digits.forEach((d, i) => {
      next[i] = d
    })
    setCode(next)
    const focusAt = Math.min(digits.length, 5)
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

          {(mode === 'login' ||
            mode === 'register' ||
            (mode === 'recovery' && recoveryStep === 'password')) && (
            <label>
              {mode === 'recovery' ? 'Новый пароль' : 'Пароль'}
              <input
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required={mode !== 'recovery' || recoveryStep === 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}

          {(mode === 'register' || (mode === 'recovery' && recoveryStep === 'password')) && (
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
            <button type="button" className="link" onClick={() => setMode('login')}>
              Уже есть аккаунт? Войти
            </button>
          )}
          {mode !== 'register' && (
            <button type="button" className="link" onClick={() => setMode('register')}>
              Нет аккаунта? Регистрация
            </button>
          )}
          {mode === 'login' && (
            <button
              type="button"
              className="link"
              onClick={() => {
                setMode('recovery')
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
