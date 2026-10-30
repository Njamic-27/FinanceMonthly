import { useState } from 'react'
import { monthRowRenameSchema, type MonthRowRename, type MonthSheetRow } from '@shared/month'
import { FieldError } from '@renderer/components/FieldError'
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
import { errorProps, fieldErrors } from '@renderer/lib/forms'
import { toast } from '@renderer/lib/toast'
import { useRenameMonthRow } from './queries'
import { t } from '@renderer/lib/i18n'

/** What renaming a row renames, for the dialog's description. */
const renames = (kind: MonthRowRename['kind']): string => t(`rename.${kind}`)

function RenameForm({
  row,
  onClose
}: {
  row: MonthSheetRow & { kind: MonthRowRename['kind'] }
  onClose: () => void
}): React.JSX.Element {
  const [name, setName] = useState(row.title)
  const [error, setError] = useState<string | undefined>()
  const rename = useRenameMonthRow()

  const submit = (event: React.FormEvent): void => {
    event.preventDefault()
    const parsed = monthRowRenameSchema.safeParse({ kind: row.kind, sourceId: row.sourceId, name })
    if (!parsed.success) {
      setError(fieldErrors(parsed.error).name)
      return
    }
    if (parsed.data.name === row.title) {
      onClose()
      return
    }
    rename.mutate(parsed.data, {
      onSuccess: () => {
        toast({ title: t('rename.done', { name: parsed.data.name }), variant: 'success' })
        onClose()
      },
      onError: (failure) => setError(failure.message)
    })
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{t('rename.title', { title: row.title })}</DialogTitle>
        <DialogDescription>{renames(row.kind)}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor="rename-row">{t('common.name')}</Label>
        <Input
          id="rename-row"
          value={name}
          autoFocus
          maxLength={40}
          onFocus={(event) => event.target.select()}
          {...errorProps('rename-row', error)}
          onChange={(event) => {
            setName(event.target.value)
            setError(undefined)
          }}
        />
        <FieldError id="rename-row-error" message={error} />
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">{t('common.cancel')}</Button>
        </DialogClose>
        <Button type="submit" disabled={rename.isPending}>
          {t('rename.action')}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Renames a category, recurring payment or savings goal from its row. */
export function RenameRowDialog({
  row,
  onClose
}: {
  /** null while closed. */
  row: (MonthSheetRow & { kind: MonthRowRename['kind'] }) | null
  onClose: () => void
}): React.JSX.Element {
  return (
    <Dialog open={row !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {row && <RenameForm key={`${row.kind}:${row.sourceId}`} row={row} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}
