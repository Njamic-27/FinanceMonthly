/** The parts of a period's money, in stacking order, with their money colour. */
export const flowParts = [
  { key: 'inflow', label: 'Money in', color: 'var(--income)', opacity: 1 },
  { key: 'fixed', label: 'Bills and planned', color: 'var(--expense)', opacity: 1 },
  { key: 'variable', label: 'Everyday spending', color: 'var(--expense)', opacity: 0.45 },
  { key: 'loans', label: 'Loan installments', color: 'var(--loan)', opacity: 1 },
  { key: 'savings', label: 'Into savings', color: 'var(--savings)', opacity: 1 }
] as const
