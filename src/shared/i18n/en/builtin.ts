import type { Message } from '../types'

export const builtin = {
  'builtin.salary': 'Salary',
  'builtin.bonus': 'Bonus',
  'builtin.other_income': 'Other income',
  'builtin.groceries': 'Groceries',
  'builtin.rent': 'Rent',
  'builtin.utilities': 'Utilities',
  'builtin.transport': 'Transport',
  'builtin.eating_out': 'Eating out',
  'builtin.health': 'Health',
  'builtin.shopping': 'Shopping',
  'builtin.entertainment': 'Entertainment',
  'builtin.subscriptions': 'Subscriptions',
  'builtin.other': 'Other'
} satisfies Record<string, Message>
