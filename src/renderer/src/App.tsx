import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { AppShell } from './app/AppShell'
import { allScreens } from './app/screens'
import { Toaster } from './components/ui/toaster'
import { UiPreview } from './dev/UiPreview'
import { OnboardingPage } from './routes/OnboardingPage'
import { PlaceholderPage } from './routes/PlaceholderPage'

function App(): React.JSX.Element {
  return (
    <HashRouter>
      <Routes>
        <Route path="/welcome" element={<OnboardingPage />} />
        <Route element={<AppShell />}>
          {allScreens.map((screen) => (
            <Route
              key={screen.path}
              path={screen.path}
              element={<PlaceholderPage screen={screen} />}
            />
          ))}
          {import.meta.env.DEV && <Route path="/dev/ui" element={<UiPreview />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Toaster />
    </HashRouter>
  )
}

export default App
