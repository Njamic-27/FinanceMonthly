import { useState } from 'react'
import { Monitor, Moon, Plus, Sun, Trash2 } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@renderer/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { getTheme, setTheme, type ThemeMode } from '@renderer/lib/theme'
import { toast } from '@renderer/lib/toast'

const moneyKinds = [
  { name: 'Income', amount: '+€2,350.00', className: 'bg-income-soft text-income' },
  { name: 'Expenses', amount: '−€1,486.25', className: 'bg-expense-soft text-expense' },
  { name: 'Savings', amount: '€3,100.00', className: 'bg-savings-soft text-savings' },
  { name: 'Loans', amount: '€640.00 owed', className: 'bg-loan-soft text-loan' }
]

function TransactionFields(): React.JSX.Element {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor="tx-title">Title</Label>
        <Input id="tx-title" placeholder="e.g. Weekly groceries" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="tx-amount">Amount</Label>
        <Input id="tx-amount" inputMode="decimal" placeholder="0.00" className="amount" />
      </div>
      <div className="grid gap-1.5">
        <Label>Paid with</Label>
        <Select defaultValue="debit">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="debit">Visa Debit</SelectItem>
            <SelectItem value="credit">Mastercard Gold</SelectItem>
            <SelectItem value="cash">Cash wallet</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5 sm:col-span-2">
        <Label>Category</Label>
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Choose a category" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Everyday</SelectLabel>
              <SelectItem value="groceries">Groceries</SelectItem>
              <SelectItem value="eating-out">Eating out</SelectItem>
              <SelectItem value="transport">Transport</SelectItem>
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>Home</SelectLabel>
              <SelectItem value="rent">Rent</SelectItem>
              <SelectItem value="utilities">Utilities</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

export function UiPreview(): React.JSX.Element {
  const [theme, setThemeState] = useState<ThemeMode>(getTheme())

  return (
    <main className="mx-auto max-w-5xl px-8 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-hero font-bold">UI kit</h1>
          <p className="mt-2 text-ink-muted">
            Base components and theme tokens. The app shell replaces this page in step 3.
          </p>
        </div>
        <Tabs
          value={theme}
          onValueChange={(value) => {
            setTheme(value as ThemeMode)
            setThemeState(value as ThemeMode)
          }}
        >
          <TabsList aria-label="Theme">
            <TabsTrigger value="system">
              <Monitor /> System
            </TabsTrigger>
            <TabsTrigger value="light">
              <Sun /> Light
            </TabsTrigger>
            <TabsTrigger value="dark">
              <Moon /> Dark
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      <section className="mb-6 rounded-panel bg-banner p-7 text-on-banner">
        <p className="font-semibold opacity-80">Total balance</p>
        <p className="amount mt-1 text-hero">€4,218.60</p>
        <p className="mt-3 text-sm opacity-80">
          Across Visa Debit, Mastercard Gold and Cash wallet
        </p>
      </section>

      <div className="mb-10 grid grid-cols-2 gap-3 md:grid-cols-4">
        {moneyKinds.map((kind) => (
          <div key={kind.name} className={`rounded-control px-4 py-3 ${kind.className}`}>
            <p className="text-sm font-semibold">{kind.name}</p>
            <p className="amount mt-0.5 text-lg">{kind.amount}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Add transaction</CardTitle>
              <CardDescription>Inputs, labels and selects.</CardDescription>
            </div>
          </CardHeader>
          <TransactionFields />
          <CardFooter>
            <Button onClick={() => toast({ title: 'Transaction saved', variant: 'success' })}>
              Save transaction
            </Button>
            <Button variant="ghost">Cancel</Button>
          </CardFooter>
        </Card>

        <div className="grid content-start gap-6">
          <Card>
            <CardTitle className="mb-4">Buttons</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">
                <Trash2 /> Delete
              </Button>
              <Button size="sm" variant="outline">
                Small
              </Button>
              <Button size="icon" variant="secondary" aria-label="Add">
                <Plus />
              </Button>
              <Button disabled>Disabled</Button>
            </div>
          </Card>

          <Card>
            <CardTitle className="mb-4">Dialog and toasts</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <Plus /> New transaction
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New transaction</DialogTitle>
                    <DialogDescription>Record money coming in or going out.</DialogDescription>
                  </DialogHeader>
                  <TransactionFields />
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="ghost">Cancel</Button>
                    </DialogClose>
                    <DialogClose asChild>
                      <Button
                        onClick={() => toast({ title: 'Transaction saved', variant: 'success' })}
                      >
                        Save transaction
                      </Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button
                variant="outline"
                onClick={() =>
                  toast({
                    title: 'Netflix renews tomorrow',
                    description: '€13.99 will be charged to Mastercard Gold.'
                  })
                }
              >
                Reminder toast
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  toast({
                    title: 'Amount is missing',
                    description: 'Enter an amount greater than zero.',
                    variant: 'error'
                  })
                }
              >
                Error toast
              </Button>
            </div>
          </Card>

          <Card>
            <Tabs defaultValue="month">
              <TabsList>
                <TabsTrigger value="week">Week</TabsTrigger>
                <TabsTrigger value="month">Month</TabsTrigger>
              </TabsList>
              <TabsContent value="week">
                <p className="text-ink-muted">Spent this week</p>
                <p className="amount text-amount">€312.40</p>
              </TabsContent>
              <TabsContent value="month">
                <p className="text-ink-muted">Spent in October</p>
                <p className="amount text-amount">€1,486.25</p>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </main>
  )
}
