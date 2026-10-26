import { useState } from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import type { Category, CategoryType } from '@shared/categories'
import { PageHeader } from '@renderer/components/PageHeader'
import { Button } from '@renderer/components/ui/button'
import { Card, CardDescription, CardTitle } from '@renderer/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { CategoryChip } from '@renderer/features/categories/CategoryChip'
import {
  CategoryDialog,
  type CategoryDialogTarget
} from '@renderer/features/categories/CategoryDialog'
import { useCategories, useUpdateCategory } from '@renderer/features/categories/queries'
import { toast } from '@renderer/lib/toast'

const tabs: { type: CategoryType; label: string; empty: string }[] = [
  {
    type: 'expense',
    label: 'Expenses',
    empty: 'No expense categories yet. Add one to start sorting your spending.'
  },
  {
    type: 'income',
    label: 'Income',
    empty: 'No income categories yet. Add one for your salary or other income.'
  }
]

function usage(category: Category): string {
  if (category.transactionCount > 0) {
    return `${category.transactionCount} transaction${category.transactionCount === 1 ? '' : 's'}`
  }
  return category.usageCount > 0 ? 'Used by recurring items' : 'Not used yet'
}

function CategoryRow({
  category,
  onOpen,
  action
}: {
  category: Category
  onOpen: () => void
  action?: React.ReactNode
}): React.JSX.Element {
  return (
    <li className="flex items-center gap-2 py-1.5 first:pt-0 last:pb-0">
      <button
        type="button"
        onClick={onOpen}
        className="group flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-control px-2 py-1.5 text-left transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary"
      >
        <CategoryChip color={category.color} icon={category.icon} />
        <span className="min-w-0 flex-1 truncate font-semibold">{category.name}</span>
        <span className="text-sm text-ink-muted">{usage(category)}</span>
        <ChevronRight
          className="size-4 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden
        />
      </button>
      {action}
    </li>
  )
}

export function CategoriesPage(): React.JSX.Element {
  const categories = useCategories()
  const updateCategory = useUpdateCategory()
  const [tab, setTab] = useState<CategoryType>('expense')
  const [dialog, setDialog] = useState<CategoryDialogTarget | null>(null)
  const all = categories.data ?? []

  const restore = (category: Category): void =>
    updateCategory.mutate(
      { id: category.id, patch: { isArchived: false } },
      {
        onSuccess: () => toast({ title: `${category.name} restored`, variant: 'success' }),
        onError: (error) =>
          toast({ title: 'Category not restored', description: error.message, variant: 'error' })
      }
    )

  return (
    <>
      <PageHeader
        title="Categories"
        description="What you sort income and spending into."
        actions={
          <Button onClick={() => setDialog({ kind: 'new', type: tab })}>
            <Plus />
            Add category
          </Button>
        }
      />

      {categories.isError ? (
        <Card className="max-w-3xl">
          <CardTitle>Categories could not be loaded</CardTitle>
          <CardDescription className="mt-1">
            {categories.error.message} Restart Financije to try again.
          </CardDescription>
        </Card>
      ) : (
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as CategoryType)}
          className="max-w-3xl"
        >
          <TabsList aria-label="Category type">
            {tabs.map(({ type, label }) => (
              <TabsTrigger key={type} value={type}>
                {label}
                <span className="text-ink-muted tabular-nums">
                  {all.filter((c) => c.type === type && !c.isArchived).length || ''}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {tabs.map(({ type, empty }) => {
            const active = all.filter((c) => c.type === type && !c.isArchived)
            const archived = all.filter((c) => c.type === type && c.isArchived)
            return (
              <TabsContent key={type} value={type} className="grid gap-6">
                <Card className="p-3">
                  {active.length > 0 ? (
                    <ul className="divide-y divide-line">
                      {active.map((category) => (
                        <CategoryRow
                          key={category.id}
                          category={category}
                          onOpen={() => setDialog({ kind: 'edit', category })}
                        />
                      ))}
                    </ul>
                  ) : (
                    categories.isSuccess && (
                      <p className="px-3 py-6 text-center text-ink-muted">{empty}</p>
                    )
                  )}
                </Card>

                {archived.length > 0 && (
                  <section>
                    <h2 className="mb-1 text-lg font-semibold">Archived</h2>
                    <p className="mb-3 text-sm text-ink-muted">
                      Not offered for new transactions. Past transactions keep them.
                    </p>
                    <Card className="p-3">
                      <ul className="divide-y divide-line">
                        {archived.map((category) => (
                          <CategoryRow
                            key={category.id}
                            category={category}
                            onOpen={() => setDialog({ kind: 'edit', category })}
                            action={
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={updateCategory.isPending}
                                onClick={() => restore(category)}
                              >
                                Restore
                              </Button>
                            }
                          />
                        ))}
                      </ul>
                    </Card>
                  </section>
                )}
              </TabsContent>
            )
          })}
        </Tabs>
      )}

      <CategoryDialog target={dialog} categories={all} onClose={() => setDialog(null)} />
    </>
  )
}
