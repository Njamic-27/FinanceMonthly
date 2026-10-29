import { useState } from 'react'
import {
  categoryCreateSchema,
  categoryIcons,
  expenseGroupLabels,
  expenseGroups,
  fallbackCategoryIcon,
  type Category,
  type CategoryIcon,
  type CategoryType,
  type ExpenseGroup
} from '@shared/categories'
import { nextPaletteColor, type PaletteColor } from '@shared/palette'
import { ActionRow } from '@renderer/components/ActionRow'
import { ColorPicker } from '@renderer/components/ColorPicker'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { SegmentedControl } from '@renderer/components/ui/segmented-control'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { ApiError } from '@renderer/lib/api'
import { toast } from '@renderer/lib/toast'
import { CategoryChip } from './CategoryChip'
import { swatchStyle } from '@renderer/lib/palette'
import { categoryIconComponents, iconLabel } from './appearance'
import {
  useCreateCategory,
  useDeleteCategory,
  useMergeCategory,
  useUpdateCategory
} from './queries'

export type CategoryDialogTarget =
  { kind: 'new'; type: CategoryType } | { kind: 'edit'; category: Category }

interface CategoryDialogProps {
  target: CategoryDialogTarget | null
  /** All categories, for merge targets and the default colour of a new one. */
  categories: Category[]
  onClose: () => void
  /** Reports success in place of a toast, e.g. inline in the setup wizard. */
  onDone?: (message: string) => void
}

const showError = (title: string) => (error: Error) =>
  toast({ title, description: error.message, variant: 'error' })

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

const groupOptions = expenseGroups.map((value) => ({ value, label: expenseGroupLabels[value] }))

function IconPicker({
  value,
  color,
  onChange
}: {
  value: CategoryIcon
  color: PaletteColor
  onChange: (icon: CategoryIcon) => void
}): React.JSX.Element {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">Icon</legend>
      <div className="grid grid-cols-13 gap-1" style={swatchStyle(color)}>
        {categoryIcons.map((icon) => {
          const Icon = categoryIconComponents[icon]
          return (
            <label
              key={icon}
              title={iconLabel(icon)}
              className="relative inline-flex size-9 cursor-pointer items-center justify-center rounded-control text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink has-checked:bg-(color:--swatch)/15 has-checked:text-(color:--swatch) has-focus-visible:outline-2 has-focus-visible:outline-primary [&_svg]:size-[1.125rem]"
            >
              <input
                type="radio"
                name="category-icon"
                value={icon}
                checked={value === icon}
                onChange={() => onChange(icon)}
                aria-label={iconLabel(icon)}
                className="sr-only"
              />
              <Icon aria-hidden />
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

type Mode = 'form' | 'merge' | 'delete'

function CategoryForm({
  target,
  categories,
  onClose,
  onDone
}: CategoryDialogProps & { target: CategoryDialogTarget }): React.JSX.Element {
  const existing = target.kind === 'edit' ? target.category : null
  const done = (message: string): void => {
    if (onDone) onDone(message)
    else toast({ title: message, variant: 'success' })
    onClose()
  }
  const type = existing?.type ?? (target.kind === 'new' ? target.type : 'expense')

  const [mode, setMode] = useState<Mode>('form')
  const [name, setName] = useState(existing?.name ?? '')
  const [color, setColor] = useState<PaletteColor>(
    existing?.color ??
      nextPaletteColor(
        categories.filter((c) => c.type === type && !c.isArchived).map((c) => c.color)
      )
  )
  const [icon, setIcon] = useState<CategoryIcon>(existing?.icon ?? fallbackCategoryIcon)
  const [group, setGroup] = useState<ExpenseGroup>(existing?.group ?? 'everyday')
  const [nameError, setNameError] = useState<string | null>(null)
  const [mergeTargetId, setMergeTargetId] = useState<string>('')

  const createCategory = useCreateCategory()
  const updateCategory = useUpdateCategory()
  const deleteCategory = useDeleteCategory()
  const mergeCategory = useMergeCategory()
  const pending =
    createCategory.isPending ||
    updateCategory.isPending ||
    deleteCategory.isPending ||
    mergeCategory.isPending

  /** A name clash belongs next to the name field; anything else is a toast. */
  const nameErrorOr =
    (title: string) =>
    (error: Error): void => {
      if (error instanceof ApiError && error.code === 'conflict') setNameError(error.message)
      else showError(title)(error)
    }

  const submit = (event: React.FormEvent): void => {
    event.preventDefault()
    const parsed = categoryCreateSchema.shape.name.safeParse(name)
    if (!parsed.success) {
      setNameError(parsed.error.issues[0]?.message ?? 'Check the name')
      return
    }
    if (existing) {
      updateCategory.mutate(
        {
          id: existing.id,
          patch: { name: parsed.data, color, icon, ...(type === 'expense' && { group }) }
        },
        {
          onSuccess: () => done('Category saved'),
          onError: nameErrorOr('Category not saved')
        }
      )
    } else {
      createCategory.mutate(
        { name: parsed.data, type, color, icon, ...(type === 'expense' && { group }) },
        {
          onSuccess: (created) => done(`${created.name} added`),
          onError: nameErrorOr('Category not added')
        }
      )
    }
  }

  if (existing && mode === 'merge') {
    const targets = categories.filter(
      (c) => c.type === existing.type && c.id !== existing.id && !c.isArchived
    )
    const merge = (): void =>
      mergeCategory.mutate(
        { sourceId: existing.id, targetId: Number(mergeTargetId) },
        {
          onSuccess: (merged) => done(`${existing.name} merged into ${merged.name}`),
          onError: showError('Categories not merged')
        }
      )
    return (
      <>
        <DialogHeader>
          <DialogTitle>Merge “{existing.name}”</DialogTitle>
          <DialogDescription>
            {existing.usageCount > 0
              ? `Its ${plural(existing.transactionCount, 'transaction')} and anything else filed under it move to the category you choose. Then “${existing.name}” is removed.`
              : `It isn't used yet, so merging simply removes “${existing.name}”.`}{' '}
            This can’t be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="merge-target">Merge into</Label>
          <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
            <SelectTrigger id="merge-target">
              <SelectValue placeholder={`Choose an ${existing.type} category`} />
            </SelectTrigger>
            <SelectContent>
              {targets.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setMode('form')}>
            Back
          </Button>
          <Button variant="danger" disabled={!mergeTargetId || pending} onClick={merge}>
            Merge categories
          </Button>
        </DialogFooter>
      </>
    )
  }

  if (existing && mode === 'delete') {
    const remove = (): void =>
      deleteCategory.mutate(existing.id, {
        onSuccess: () => done(`${existing.name} deleted`),
        onError: showError('Category not deleted')
      })
    return (
      <>
        <DialogHeader>
          <DialogTitle>Delete “{existing.name}”?</DialogTitle>
          <DialogDescription>
            Nothing is filed under it, so no transactions change. This can’t be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setMode('form')}>
            Back
          </Button>
          <Button variant="danger" disabled={pending} onClick={remove}>
            Delete category
          </Button>
        </DialogFooter>
      </>
    )
  }

  const setArchived = (isArchived: boolean): void => {
    if (!existing) return
    updateCategory.mutate(
      { id: existing.id, patch: { isArchived } },
      {
        onSuccess: () => done(`${existing.name} ${isArchived ? 'archived' : 'restored'}`),
        onError: showError(isArchived ? 'Category not archived' : 'Category not restored')
      }
    )
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{existing ? 'Edit category' : `New ${type} category`}</DialogTitle>
        <DialogDescription>
          {existing
            ? existing.transactionCount > 0
              ? `Used by ${plural(existing.transactionCount, 'transaction')}. Changes show everywhere it's used.`
              : 'Not used by any transactions yet.'
            : `Sort your ${type === 'income' ? 'income' : 'spending'} into it when you add transactions.`}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-5">
        <div className="grid gap-1.5">
          <Label htmlFor="category-name">Name</Label>
          <div className="flex items-center gap-3">
            <CategoryChip color={color} icon={icon} />
            <Input
              id="category-name"
              value={name}
              autoFocus
              maxLength={40}
              placeholder={type === 'income' ? 'e.g. Freelance' : 'e.g. Pets'}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? 'category-name-error' : undefined}
              onChange={(event) => {
                setName(event.target.value)
                setNameError(null)
              }}
            />
          </div>
          {nameError && (
            <p id="category-name-error" className="text-sm text-expense">
              {nameError}
            </p>
          )}
        </div>
        {type === 'expense' && (
          <div className="grid gap-1.5">
            <Label id="category-group-label">Group</Label>
            <SegmentedControl
              name="category-group"
              aria-labelledby="category-group-label"
              value={group}
              options={groupOptions}
              onValueChange={setGroup}
              className="justify-self-start"
            />
            <p className="text-sm text-ink-muted">Where it sits under Money out on Month.</p>
          </div>
        )}
        <ColorPicker name="category-color" value={color} onChange={setColor} />
        <IconPicker value={icon} color={color} onChange={setIcon} />
      </div>

      {existing && (
        <div className="mt-6 divide-y divide-line border-t border-line">
          <ActionRow
            title={existing.isArchived ? 'Restore' : 'Archive'}
            description={
              existing.isArchived
                ? 'Offer it again when adding transactions.'
                : 'Stop offering it for new transactions. Past ones keep it.'
            }
          >
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => setArchived(!existing.isArchived)}
            >
              {existing.isArchived ? 'Restore category' : 'Archive category'}
            </Button>
          </ActionRow>
          <ActionRow
            title="Merge"
            description={`Move everything in it to another ${existing.type} category.`}
          >
            <Button variant="outline" size="sm" disabled={pending} onClick={() => setMode('merge')}>
              Merge…
            </Button>
          </ActionRow>
          <ActionRow
            title="Delete"
            description={
              existing.usageCount > 0
                ? 'Only unused categories can be deleted. Archive or merge this one instead.'
                : 'Remove it for good.'
            }
          >
            {existing.usageCount === 0 && (
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                className="text-expense"
                onClick={() => setMode('delete')}
              >
                Delete…
              </Button>
            )}
          </ActionRow>
        </div>
      )}

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Cancel</Button>
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {existing ? 'Save category' : 'Add category'}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Add or edit a category; editing also offers archive, merge and delete. */
export function CategoryDialog({
  target,
  categories,
  onClose,
  onDone
}: CategoryDialogProps): React.JSX.Element {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[min(36rem,calc(100vw-2rem))]">
        {target && (
          <CategoryForm
            key={target.kind === 'edit' ? target.category.id : `new-${target.type}`}
            target={target}
            categories={categories}
            onClose={onClose}
            onDone={onDone}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
