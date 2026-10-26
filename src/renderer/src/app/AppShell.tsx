import { useEffect } from 'react'
import { Outlet } from 'react-router'
import { openTransactionDialog } from '@renderer/features/transactions/dialogStore'
import { TransactionDialog } from '@renderer/features/transactions/TransactionDialog'
import { Sidebar } from './Sidebar'

export function AppShell(): React.JSX.Element {
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
