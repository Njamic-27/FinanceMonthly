import { z } from 'zod'

export const categoryTypes = ['income', 'expense'] as const
export type CategoryType = (typeof categoryTypes)[number]

/**
 * Category colours, stored by name so each one has a light and a dark step (main.css,
 * `--cat-*`). The first eight are in validated order: neighbours stay distinguishable with
 * colour-vision deficiencies, so assign them in this order. `slate` is the neutral for
 * "Other". Green, red, amber and violet are left out — they mean money kinds (DESIGN.md).
 */
export const categoryColors = [
  'blue',
  'orange',
  'aqua',
  'plum',
  'olive',
  'pink',
  'brown',
  'sky',
  'slate'
] as const
export type CategoryColor = (typeof categoryColors)[number]

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

/** Used when a stored colour or icon is missing or no longer offered. */
export const fallbackCategoryColor: CategoryColor = 'slate'
export const fallbackCategoryIcon: CategoryIcon = 'tag'

export interface Category {
  id: number
  name: string
  type: CategoryType
  color: CategoryColor
  icon: CategoryIcon
  isArchived: boolean
  sortOrder: number
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
    color: z.enum(categoryColors),
    icon: z.enum(categoryIcons)
  })
  .strict()
export type CategoryCreate = z.infer<typeof categoryCreateSchema>

/** The type can't change: transactions already count the category as income or expense. */
export const categoryUpdateSchema = z
  .object({
    name,
    color: z.enum(categoryColors),
    icon: z.enum(categoryIcons),
    isArchived: z.boolean()
  })
  .partial()
  .strict()
export type CategoryUpdate = z.infer<typeof categoryUpdateSchema>
