import { z } from 'zod'
import { paletteColors, type PaletteColor } from './palette'

export const categoryTypes = ['income', 'expense'] as const
export type CategoryType = (typeof categoryTypes)[number]

/**
 * The group an expense category belongs to on Month (PLAN.md step 48). Loans and Savings are
 * groups there too, made of loans and goals rather than categories.
 */
export const expenseGroups = ['everyday', 'bills', 'subscriptions'] as const
export type ExpenseGroup = (typeof expenseGroups)[number]

/** Icons offered for categories; the renderer maps each name to a lucide icon. */
export const categoryIcons = [
  'briefcase',
  'banknote',
  'coins',
  'hand-coins',
  'trending-up',
  'gift',
  'shopping-cart',
  'house',
  'zap',
  'wifi',
  'smartphone',
  'bus',
  'car',
  'fuel',
  'plane',
  'utensils',
  'coffee',
  'heart-pulse',
  'pill',
  'dumbbell',
  'shopping-bag',
  'shirt',
  'scissors',
  'sofa',
  'film',
  'music',
  'gamepad-2',
  'ticket',
  'book-open',
  'graduation-cap',
  'laptop',
  'baby',
  'paw-print',
  'wrench',
  'receipt',
  'repeat',
  'sparkles',
  'tag',
  'circle-ellipsis'
] as const
export type CategoryIcon = (typeof categoryIcons)[number]

/** Used when a stored icon is missing or no longer offered. */
export const fallbackCategoryIcon: CategoryIcon = 'tag'

export interface Category {
  id: number
  name: string
  type: CategoryType
  color: PaletteColor
  icon: CategoryIcon
  isArchived: boolean
  sortOrder: number
  /** Expense categories' group on Month; null for income. */
  group: ExpenseGroup | null
  /** Set on the categories the app created, until step 55 renames them by language. */
  builtinKey: string | null
  /** Transactions in this category. */
  transactionCount: number
  /** Everything that refers to it: transactions, recurring items and installment plans. */
  usageCount: number
}

export const categoryIdSchema = z.number().int().positive()

const name = z
  .string()
  .trim()
  .min(1, 'Give the category a name')
  .max(40, 'Keep the name to 40 characters or fewer')

export const categoryCreateSchema = z
  .object({
    name,
    type: z.enum(categoryTypes),
    color: z.enum(paletteColors),
    icon: z.enum(categoryIcons),
    /** Expense categories only; Everyday when left out. */
    group: z.enum(expenseGroups).optional()
  })
  .strict()
export type CategoryCreate = z.input<typeof categoryCreateSchema>

/** The type can't change: transactions already count the category as income or expense. */
export const categoryUpdateSchema = z
  .object({
    name,
    color: z.enum(paletteColors),
    icon: z.enum(categoryIcons),
    isArchived: z.boolean(),
    /** Expense categories only. */
    group: z.enum(expenseGroups)
  })
  .partial()
  .strict()
export type CategoryUpdate = z.infer<typeof categoryUpdateSchema>
