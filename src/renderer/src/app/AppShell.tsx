import { useEffect } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router'
import { BackButton } from '@renderer/components/BackButton'
import { canGoBack } from '@renderer/lib/history'
import { t } from '@renderer/lib/i18n'
import { useSettings } from '@renderer/features/settings/queries'
import { openTransactionDialog } from '@renderer/features/transactions/dialogStore'
import { TransactionDialog } from '@renderer/features/transactions/TransactionDialog'
import { allScreens } from './screens'
import { Sidebar } from './Sidebar'
import { useMainEvents } from './useMainEvents'

/** The screen a detail page belongs to (`/accounts/3` → Accounts), for Back with no history. */
function parentScreen(pathname: string): { to: string; label: string } | undefined {
  const [, first, rest] = pathname.split('/')
  if (!rest) return undefined
  const screen = allScreens.find((s) => s.path === `/${first}`)
  return screen && { to: screen.path, label: t(screen.titleKey) }
}

export function AppShell(): React.JSX.Element | null {
  const settings = useSettings()
  const location = useLocation()
  const navigate = useNavigate()
  useMainEvents()

  // Ctrl+N opens "Add transaction" from anywhere in the app; Alt+Left goes back.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.ctrlKey && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        openTransactionDialog()
      } else if (event.altKey && !event.ctrlKey && !event.shiftKey && event.key === 'ArrowLeft') {
        event.preventDefault()
        if (canGoBack()) void navigate(-1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navigate])

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
        <div className="mx-auto max-w-6xl px-10 pt-5 pb-9">
          <BackButton fallback={parentScreen(location.pathname)} />
          <Outlet />
        </div>
      </main>
      <TransactionDialog />
    </div>
  )
}
