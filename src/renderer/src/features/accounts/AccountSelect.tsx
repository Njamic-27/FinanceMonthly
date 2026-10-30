import type { Account } from '@shared/accounts'
import { ColorChip } from '@renderer/components/ColorChip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { errorProps } from '@renderer/lib/forms'
import { accountTypeIcons } from './appearance'
import { t } from '@renderer/lib/i18n'

interface AccountSelectProps {
  id: string
  /** The account id as a string, or '' for none. */
  value: string
  accounts: Account[]
  error?: string
  onChange: (value: string) => void
}

export function AccountSelect({
  id,
  value,
  accounts,
  error,
  onChange
}: AccountSelectProps): React.JSX.Element {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} {...errorProps(id, error)}>
        <SelectValue placeholder={t('recurring.chooseAnAccount')} />
      </SelectTrigger>
      <SelectContent>
        {accounts.map((a) => (
          <SelectItem key={a.id} value={String(a.id)}>
            <span className="flex items-center gap-2">
              <ColorChip color={a.color} icon={accountTypeIcons[a.type]} size="sm" />
              {a.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
