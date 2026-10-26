import { CreditCard, Landmark, Wallet, type LucideIcon } from 'lucide-react'
import type { AccountType } from '@shared/accounts'

export const accountTypeIcons: Record<AccountType, LucideIcon> = {
  debit: Landmark,
  credit: CreditCard,
  cash: Wallet
}
