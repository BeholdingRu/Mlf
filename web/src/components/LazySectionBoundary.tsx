import { Component, type ErrorInfo, type ReactNode } from 'react'

type LazySectionBoundaryProps = {
  children: ReactNode
  label?: string
}

type LazySectionBoundaryState = {
  failed: boolean
}

export class LazySectionBoundary extends Component<
  LazySectionBoundaryProps,
  LazySectionBoundaryState
> {
  state: LazySectionBoundaryState = { failed: false }

  static getDerivedStateFromError(): LazySectionBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Failed to load interface section:', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <section className="panel lazy-section-error" role="alert">
        <p>
          Не удалось загрузить {this.props.label ?? 'раздел'}. Проверьте подключение к интернету.
        </p>
        <button type="button" className="primary" onClick={() => window.location.reload()}>
          Повторить загрузку
        </button>
      </section>
    )
  }
}
