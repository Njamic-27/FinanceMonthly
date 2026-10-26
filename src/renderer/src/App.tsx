import { Toaster } from './components/ui/toaster'
import { UiPreview } from './dev/UiPreview'

function App(): React.JSX.Element {
  return (
    <>
      <UiPreview />
      <Toaster />
    </>
  )
}

export default App
