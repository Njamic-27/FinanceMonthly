import type { Migration } from '../migrate'
import { migration001 } from './001_initial'
import { migration002 } from './002_default_categories'
import { migration003 } from './003_loan_auto_pay'
import { migration004 } from './004_month_sheet'
import { migration005 } from './005_balance_adjustments'
import { migration006 } from './006_counts_on'
import { migration007 } from './007_groups_and_pay_from'
import { migration008 } from './008_installment_numbers'
import { migration009 } from './009_deleted_transactions'

/** All migrations in order. Never edit a released migration — add a new one. */
export const migrations: Migration[] = [
  migration001,
  migration002,
  migration003,
  migration004,
  migration005,
  migration006,
  migration007,
  migration008,
  migration009
]
