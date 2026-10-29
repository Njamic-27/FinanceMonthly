import { lazy, Suspense } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router'
import { AppShell } from './app/AppShell'
import { allScreens } from './app/screens'
import { Toaster } from './components/ui/toaster'
import { queryClient } from './lib/queryClient'
import { OnboardingPage } from './routes/OnboardingPage'
import { PlaceholderPage } from './routes/PlaceholderPage'
import { AccountDetailPage } from './routes/AccountDetailPage'
import { AccountsPage } from './routes/AccountsPage'
import { CalendarPage } from './routes/CalendarPage'
import { CategoriesPage } from './routes/CategoriesPage'
import { HistoryPage } from './routes/HistoryPage'
import { LoanPage } from './routes/LoanPage'
import { LoansPage } from './routes/LoansPage'
import { MonthPage } from './routes/MonthPage'
import { OverviewPage } from './routes/OverviewPage'
import { ProjectionsPage } from './routes/ProjectionsPage'
import { RecurringPage } from './routes/RecurringPage'
import { SavingsGoalPage } from './routes/SavingsGoalPage'
import { SavingsPage } from './routes/SavingsPage'
import { TransactionsPage } from './routes/TransactionsPage'
import { SettingsPage } from './routes/SettingsPage'

// The UI kit and its dev tools (seed / reset) exist only in development builds: in
// production this is null and the dev module is left out of the bundle.
const UiPreview = import.meta.env.DEV
  ? lazy(() => import('./dev/UiPreview').then((m) => ({ default: m.UiPreview })))
  : null

/** Screens that are built; the rest show their placeholder. Keyed by screen path. */
const pages: Record<string, () => React.JSX.Element> = {
  '/': MonthPage,
  '/transactions': TransactionsPage,
  '/overview': OverviewPage,
  '/calendar': CalendarPage,
  '/history': HistoryPage,
  '/projections': ProjectionsPage,
  '/accounts': AccountsPage,
  '/recurring': RecurringPage,
  '/savings': SavingsPage,
  '/loans': LoansPage,
  '/categories': CategoriesPage,
  '/settings': SettingsPage
}

/** Sends an old address to where the screen lives now, keeping its `?month=` and such. */
function Moved({ to }: { to: string }): React.JSX.Element {
  const { search } = useLocation()
  return <Navigate to={{ pathname: to, search }} replace />
}

function App(): React.JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <Routes>
          <Route path="/welcome" element={<OnboardingPage />} />
          <Route element={<AppShell />}>
            {allScreens.map((screen) => {
              const Page = pages[screen.path]
              return (
                <Route
                  key={screen.path}
                  path={screen.path}
                  element={Page ? <Page /> : <PlaceholderPage screen={screen} />}
                />
              )
            })}
            <Route path="/month" element={<Moved to="/" />} />
            {/* The Dashboard was removed in step 38; Month has what it showed. */}
            <Route path="/dashboard" element={<Moved to="/" />} />
            <Route path="/accounts/:id" element={<AccountDetailPage />} />
            <Route path="/savings/:id" element={<SavingsGoalPage />} />
            <Route path="/loans/:id" element={<LoanPage />} />
            {UiPreview && (
              <Route
                path="/dev/ui"
                element={
                  <Suspense>
                    <UiPreview />
                  </Suspense>
                }
              />
            )}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        <Toaster />
      </HashRouter>
    </QueryClientProvider>
  )
}

export default App
