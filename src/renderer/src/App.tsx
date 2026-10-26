import { lazy, Suspense } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { AppShell } from './app/AppShell'
import { allScreens } from './app/screens'
import { Toaster } from './components/ui/toaster'
import { queryClient } from './lib/queryClient'
import { OnboardingPage } from './routes/OnboardingPage'
import { PlaceholderPage } from './routes/PlaceholderPage'
import { AccountsPage } from './routes/AccountsPage'
import { CategoriesPage } from './routes/CategoriesPage'
import { TransactionsPage } from './routes/TransactionsPage'
import { SettingsPage } from './routes/SettingsPage'

// The UI kit and its dev tools (seed / reset) exist only in development builds: in
// production this is null and the dev module is left out of the bundle.
const UiPreview = import.meta.env.DEV
  ? lazy(() => import('./dev/UiPreview').then((m) => ({ default: m.UiPreview })))
  : null

/** Screens that are built; the rest show their placeholder. Keyed by screen path. */
const pages: Record<string, () => React.JSX.Element> = {
  '/transactions': TransactionsPage,
  '/accounts': AccountsPage,
  '/categories': CategoriesPage,
  '/settings': SettingsPage
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
