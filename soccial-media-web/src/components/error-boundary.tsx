import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { hasError: boolean }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', gap: 16, padding: 24, textAlign: 'center' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#e53e3e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#1a202c' }}>Đã xảy ra lỗi không mong muốn</h2>
          <p style={{ margin: 0, color: '#718096', fontSize: '0.9rem' }}>Trang gặp sự cố. Vui lòng thử tải lại.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: '#0052ce', color: '#fff', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}
          >
            Tải lại trang
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
