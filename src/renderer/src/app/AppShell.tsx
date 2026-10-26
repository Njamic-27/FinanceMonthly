import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useSettings } from '@renderer/features/settings/queries'
import { openTransactionDialog } from '@renderer/features/transactions/dialogStore'
import { TransactionDialog } from '@renderer/features/transactions/TransactionDialog'
import { Sidebar } from './Sidebar'

export function AppShell(): React.JSX.Element | null {
  const settings = useSettings()
  const location = useLocation()

  // Ctrl+N opens "Add transaction" from anywhere in the app.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.ctrlKey && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        openTransactionDialog()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Wait for settings so the first run never flashes the app before the welcome wizard.
  if (!settings.data && !settings.isError) return null
  // First run goes to the wizard; the dev UI kit stays reachable (seed / reset live there).
  if (settings.data && !settings.data.onboardingDone && !location.pathname.startsWith('/dev')) {
    return <Navigate to="/welcome" replace />
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar onAddTransaction={() => openTransactionDialog()} />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-10 py-9">
          <Outlet />
        </div>
      </main>
      <TransactionDialog />
    </div>
  )
}
