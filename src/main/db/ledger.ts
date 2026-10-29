// Sign rules for the ledger (PLAN.md §2). Amounts are stored positive; the type gives the sign
// for the account in `account_id`. A transfer is also added to `to_account_id`, which callers
// handle separately.

export const incomingTypes = ['income', 'savings_withdrawal', 'loan_in', 'adjustment_in'] as const
export const outgoingTypes = [
  'expense',
  'savings_deposit',
  'loan_out',
  'transfer',
  'adjustment_out'
] as const

const list = (types: readonly string[]): string => types.map((t) => `'${t}'`).join(', ')

/** `amount` signed for its `account_id`: + for money in, − for money out. */
export function signedAmountSql(alias = 't'): string {
  return `CASE WHEN ${alias}.type IN (${list(incomingTypes)}) THEN ${alias}.amount ELSE -${alias}.amount END`
}
