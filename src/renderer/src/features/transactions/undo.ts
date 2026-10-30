import { invoke } from '@renderer/lib/api'
import { t } from '@renderer/lib/i18n'
import { queryClient } from '@renderer/lib/queryClient'
import { toast } from '@renderer/lib/toast'

/**
 * "Deleted", with Undo: puts the transaction back as it was. A plain function rather than a
 * mutation hook, so Undo still works after the dialog or panel it was deleted from has closed.
 */
export function deletedToast(deletedId: number, title: string): void {
  toast({
    title: t('transactions.deletedNamed', { title }),
    variant: 'success',
    action: {
      label: t('transactions.undo'),
      run: async () => {
        try {
          await invoke('transactions:restore', deletedId)
          await queryClient.invalidateQueries()
          toast({ title: t('transactions.restored', { title }), variant: 'success' })
        } catch (error) {
          toast({
            title: t('transactions.notRestored'),
            description: error instanceof Error ? error.message : undefined,
            variant: 'error'
          })
        }
      }
    }
  })
}
