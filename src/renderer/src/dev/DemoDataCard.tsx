import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Database, RotateCcw } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Card, CardDescription, CardTitle } from '@renderer/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { invoke } from '@renderer/lib/api'
import { toast } from '@renderer/lib/toast'

type Action = 'seed' | 'reset'

const confirmations: Record<Action, { title: string; body: string; button: string }> = {
  seed: {
    title: 'Replace the dev database with demo data?',
    body: 'Everything in finance-dev.db is deleted, then filled with a year of accounts, transactions, subscriptions, an installment plan, a savings goal and a loan.',
    button: 'Seed demo data'
  },
  reset: {
    title: 'Reset the dev database?',
    body: 'Everything in finance-dev.db is deleted and the app starts as on its first run.',
    button: 'Reset dev database'
  }
}

/** Development builds only: fill or empty finance-dev.db. */
export function DemoDataCard(): React.JSX.Element {
  const queryClient = useQueryClient()
  const [confirm, setConfirm] = useState<Action | null>(null)

  const done = async (): Promise<void> => {
    setConfirm(null)
    // Every cached query describes the old database.
    await queryClient.resetQueries()
  }
  const seed = useMutation({
    mutationFn: () => invoke('dev:seed'),
    onSuccess: async (summary) => {
      await done()
      toast({
        title: 'Demo data added',
        description: `${summary.transactions} transactions from ${summary.from} to ${summary.to}, ${summary.accounts} accounts, ${summary.recurringItems} recurring items.`,
        variant: 'success'
      })
    }
  })
  const reset = useMutation({
    mutationFn: () => invoke('dev:reset'),
    onSuccess: async () => {
      await done()
      toast({ title: 'Dev database reset', variant: 'success' })
    }
  })
  const onError = (error: Error): void =>
    toast({ title: 'That didn’t work', description: error.message, variant: 'error' })
  const pending = seed.isPending || reset.isPending

  return (
    <Card>
      <CardTitle className="mb-1">Demo data</CardTitle>
      <CardDescription className="mb-4">
        Fills finance-dev.db with about a year of realistic data, or empties it. Only in development
        builds; never touches finance.db.
      </CardDescription>
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending} onClick={() => setConfirm('seed')}>
          <Database />
          Seed demo data
        </Button>
        <Button variant="outline" disabled={pending} onClick={() => setConfirm('reset')}>
          <RotateCcw />
          Reset dev database
        </Button>
      </div>

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          {confirm && (
            <>
              <DialogHeader>
                <DialogTitle>{confirmations[confirm].title}</DialogTitle>
                <DialogDescription>{confirmations[confirm].body}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button
                  variant="danger"
                  disabled={pending}
                  onClick={() =>
                    confirm === 'seed'
                      ? seed.mutate(undefined, { onError })
                      : reset.mutate(undefined, { onError })
                  }
                >
                  {pending ? 'Working…' : confirmations[confirm].button}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
