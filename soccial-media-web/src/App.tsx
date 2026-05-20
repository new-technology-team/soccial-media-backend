import { BrowserRouter } from 'react-router-dom'
import AppShell from '@/components/navigation/app-shell'
import { AppRouter } from '@/routes'

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <AppRouter />
      </AppShell>
    </BrowserRouter>
  )
}
