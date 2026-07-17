import { BrowserRouter } from 'react-router-dom'
import AppShell from '@/components/navigation/app-shell'
import { AppRouter } from '@/routes'
import ErrorBoundary from '@/components/error-boundary'

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppShell>
          <AppRouter />
        </AppShell>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
