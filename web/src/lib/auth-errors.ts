function getErrorMessage(error: unknown): string | null {
  return error instanceof Error ? error.message : null
}

function getErrorStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null || !('status' in error)) return null
  const { status } = error as { status?: unknown }
  return typeof status === 'number' ? status : null
}

export function getAuthErrorMessage(error: unknown, fallback: string): string {
  const message = getErrorMessage(error)
  if (!message) return fallback

  if (/^[А-Яа-яЁё]/.test(message)) return message

  const normalized = message.toLowerCase()
  if (
    getErrorStatus(error) === 429 ||
    normalized.includes('rate limit') ||
    normalized.includes('too many requests')
  ) {
    return 'Слишком много попыток. Попробуйте позже.'
  }
  if (normalized.includes('invalid login credentials')) {
    return 'Неверный email или пароль.'
  }
  if (normalized.includes('email not confirmed')) {
    return 'Подтвердите email, прежде чем войти в аккаунт.'
  }
  if (normalized.includes('user already registered')) {
    return 'Пользователь с таким email уже зарегистрирован.'
  }
  if (normalized.includes('password should be at least')) {
    return 'Пароль должен содержать минимум 6 символов.'
  }
  if (
    normalized.includes('token has expired') ||
    normalized.includes('otp expired') ||
    normalized.includes('expired token')
  ) {
    return 'Срок действия кода истёк. Запросите новый код.'
  }
  if (normalized.includes('invalid otp') || normalized.includes('token is invalid')) {
    return 'Код неверный. Проверьте его и попробуйте снова.'
  }
  if (normalized.includes('same password')) {
    return 'Новый пароль должен отличаться от текущего.'
  }
  if (normalized.includes('current password')) {
    return 'Текущий пароль указан неверно.'
  }
  if (normalized.includes('invalid email')) {
    return 'Укажите корректный email.'
  }

  return fallback
}
