import type { Migration } from '../migrate'
import { migration001 } from './001_initial'
import { migration002 } from './002_default_categories'
import { migration003 } from './003_loan_auto_pay'
import { migration004 } from './004_month_sheet'
import { migration005 } from './005_balance_adjustments'

/** All migrations in order. Never edit a released migration — add a new one. */
export const migrations: Migration[] = [
  migration001,
  migration002,
  migration003,
  migration004,
  migration005
]
