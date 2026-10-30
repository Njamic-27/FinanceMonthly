import type { ExpenseGroup } from '@shared/categories'
import type { LoanKind } from '@shared/loans'
import type { MonthLineType } from '@shared/month'
import { subscriptionCategoryName, subscriptionPresets } from '@shared/subscription-presets'
import { foldText } from '@shared/text'
import type { AddChoice } from './cells'
import { t } from '@renderer/lib/i18n'

// What "+" on Income or Expenses offers (PLAN.md §3, Month; step 51). Income: a category to add
// to, picked or created by name. Expenses: first a group (Subscriptions, Bills, Everyday, Loans,
// Savings), then what's in it; typing at the top searches every group at once.

/** A group "+" on Expenses opens. */
export type AddGroupKey = ExpenseGroup | 'loans' | 'savings'

export const addGroupKeys: AddGroupKey[] = [
  'subscriptions',
  'bills',
  'everyday',
  'loans',
  'savings'
]

export const addGroupLabel = (group: AddGroupKey): string => t(`group.${group}`)

export type AddAction =
  /** Opens a group's own list. */
  | { kind: 'group'; group: AddGroupKey }
  /**
   * Something in a category, one-time or recurring: an existing one by name, or a new one (an
   * expense one in `group`). `title` is its own name, e.g. a subscription picked from presets.
   */
  | {
      kind: 'line'
      type: MonthLineType
      name: string
      isNew: boolean
      group?: ExpenseGroup
      title?: string
    }
  /** A dialog that adds something new: a card, loan, goal or account. */
  | { kind: 'open'; choice: AddChoice }
  | { kind: 'pay_card'; accountId: number }
  | { kind: 'loan'; loanId: number }
  | { kind: 'savings'; goalId: number; movement: 'deposit' | 'withdrawal' }

export interface AddEntry {
  key: string
  label: string
  description?: string
  action: AddAction
}

export interface AddGroup {
  heading: string
  entries: AddEntry[]
}

export interface AddMenuData {
  categories: {
    id: number
    name: string
    type: MonthLineType
    /** An expense category's group; null for income. */
    group: ExpenseGroup | null
    isArchived: boolean
  }[]
  /** Active credit cards. */
  cards: { id: number; name: string }[]
  /** Active loans. */
  loans: { id: number; title: string; kind: LoanKind }[]
  /** Active savings goals. */
  goals: { id: number; name: string; saved: number }[]
}

const loanLabels: Record<LoanKind, (title: string) => string> = {
  bank_loan: (title) => t('add.payLoanInstallment', { title }),
  borrowed: (title) => t('add.repay', { title }),
  lent: (title) => t('add.repaymentOf', { title })
}

type Category = AddMenuData['categories'][number]

const lineOf = (c: Category): AddAction => ({
  kind: 'line',
  type: c.type,
  name: c.name,
  isNew: false,
  group: c.group ?? undefined
})

const open = (choice: AddChoice, label: string, description?: string): AddEntry => ({
  key: choice,
  label,
  description,
  action: { kind: 'open', choice }
})

/** What a group holds, before filtering; the categories are filtered by the caller. */
function groupEntries(group: AddGroupKey, data: AddMenuData): AddEntry[] {
  if (group === 'loans') {
    return [
      ...data.loans.map((loan): AddEntry => ({
        key: `loan-${loan.id}`,
        label: loanLabels[loan.kind](loan.title),
        action: { kind: 'loan', loanId: loan.id }
      })),
      open('bank_loan', t('add.newBankLoan'), t('add.newBankLoanHint')),
      open('borrowed', t('add.borrowed'), t('add.borrowedHint')),
      open('lent', t('add.lent'), t('add.lentHint'))
    ]
  }
  if (group === 'savings') {
    return [
      ...data.goals.flatMap((goal): AddEntry[] => [
        {
          key: `deposit-${goal.id}`,
          label: t('add.putInto', { goal: goal.name }),
          action: { kind: 'savings', goalId: goal.id, movement: 'deposit' }
        },
        ...(goal.saved > 0
          ? [
              {
                key: `withdrawal-${goal.id}`,
                label: t('add.takeOut', { goal: goal.name }),
                action: { kind: 'savings', goalId: goal.id, movement: 'withdrawal' } as const
              }
            ]
          : [])
      ]),
      open('goal', t('add.newGoal'))
    ]
  }
  return []
}

/** Subscription presets go in the Subscriptions category (or the group's first one). */
function presetEntries(data: AddMenuData): AddEntry[] {
  const inGroup = data.categories.filter(
    (c) => c.type === 'expense' && c.group === 'subscriptions' && !c.isArchived
  )
  const home =
    inGroup.find((c) => c.name === subscriptionCategoryName()) ??
    inGroup[0] ??
    data.categories.find(
      (c) => c.type === 'expense' && foldText(c.name) === foldText(subscriptionCategoryName())
    )
  const name = home?.name ?? subscriptionCategoryName()
  const taken = new Set(data.categories.map((c) => foldText(c.name)))
  return subscriptionPresets
    .filter((preset) => !taken.has(foldText(preset)))
    .map((preset): AddEntry => ({
      key: `preset-${preset}`,
      label: preset,
      description: t('add.inCategory', { name }),
      action: {
        kind: 'line',
        type: 'expense',
        name,
        isNew: !home,
        group: 'subscriptions',
        title: preset
      }
    }))
}

/**
 * The menu for one section, filtered by what's typed (ignoring case and accents). Under
 * Expenses with no `group` open, it lists the groups and, once something is typed, matches
 * from all of them. Typing a name no category has offers to create it (in the open group, else
 * Everyday); an archived one is offered back by its exact name.
 */
export function addMenu(
  section: 'income' | 'expenses',
  query: string,
  data: AddMenuData,
  group: AddGroupKey | null = null
): AddGroup[] {
  const type: MonthLineType = section === 'income' ? 'income' : 'expense'
  const typed = query.trim()
  const needle = foldText(typed)
  const matches = (...texts: string[]): boolean =>
    needle === '' || texts.some((text) => foldText(text).includes(needle))

  const ofType = data.categories.filter((c) => c.type === type)
  const exact = ofType.find((c) => foldText(c.name) === needle)
  const createIn: ExpenseGroup | undefined =
    type === 'income'
      ? undefined
      : group === 'bills' || group === 'subscriptions'
        ? group
        : 'everyday'
  const create: AddEntry[] =
    typed && !exact && group !== 'loans' && group !== 'savings'
      ? [
          {
            key: 'create',
            label: t('add.create', { name: typed }),
            description: createIn
              ? t('add.newCategoryIn', { group: addGroupLabel(createIn) })
              : t('add.newIncomeCategory'),
            action: { kind: 'line', type, name: typed, isNew: true, group: createIn }
          }
        ]
      : []
  const categoryEntries = (inGroup: (c: Category) => boolean, describe: boolean): AddEntry[] =>
    ofType
      .filter((c) => (c.isArchived ? c === exact : inGroup(c) && matches(c.name)))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c): AddEntry => ({
        key: `category-${c.id}`,
        label: c.name,
        description: c.isArchived
          ? t('add.archived')
          : describe && c.group
            ? t('add.inGroup', { group: addGroupLabel(c.group) })
            : undefined,
        action: lineOf(c)
      }))
  const filtered = (groups: AddGroup[]): AddGroup[] =>
    groups
      .map((g) => ({
        ...g,
        entries: g.entries.filter(
          (e) =>
            e.key === 'create' ||
            e.key.startsWith('category-') ||
            matches(e.label, e.description ?? '', g.heading)
        )
      }))
      .filter((g) => g.entries.length > 0)

  if (section === 'income') {
    return filtered([
      {
        heading: t('add.headingCategories'),
        entries: [...create, ...categoryEntries(() => true, false)]
      }
    ])
  }

  if (group === 'subscriptions' || group === 'bills' || group === 'everyday') {
    return filtered([
      {
        heading: addGroupLabel(group),
        entries: [
          ...create,
          // A name typed in full is that category, whichever group it's in.
          ...categoryEntries((c) => c.group === group || c === exact, true)
        ]
      },
      ...(group === 'subscriptions'
        ? [{ heading: t('add.headingServices'), entries: presetEntries(data) }]
        : [])
    ])
  }
  if (group)
    return filtered([{ heading: addGroupLabel(group), entries: groupEntries(group, data) }])

  const extras: AddGroup = {
    heading: t('add.headingCardsAccounts'),
    entries: [
      ...data.cards.map((card): AddEntry => ({
        key: `card-${card.id}`,
        label: t('add.payCard', { card: card.name }),
        description: t('add.payCardHint'),
        action: { kind: 'pay_card', accountId: card.id }
      })),
      open('transfer', t('add.transfer'), t('add.transferHint')),
      open('account', t('add.account'))
    ]
  }
  const groupList: AddGroup = {
    heading: t('add.headingAddTo'),
    entries: addGroupKeys.map((key): AddEntry => ({
      key: `group-${key}`,
      label: addGroupLabel(key),
      description: groupDescription(key, data),
      action: { kind: 'group', group: key }
    }))
  }
  if (!typed) return [groupList, extras]

  // Typed at the top: every group's matches, the groups themselves by name.
  return filtered([
    {
      ...groupList,
      entries: groupList.entries.filter((e) => matches(e.label))
    },
    {
      heading: t('add.headingCategories'),
      entries: [...create, ...categoryEntries(() => true, true)]
    },
    { heading: t('add.headingServices'), entries: presetEntries(data) },
    { heading: addGroupLabel('loans'), entries: groupEntries('loans', data) },
    { heading: addGroupLabel('savings'), entries: groupEntries('savings', data) },
    extras
  ])
}

/** A group's line in the top list: what's in it, or what it's for. */
function groupDescription(group: AddGroupKey, data: AddMenuData): string {
  const names = (list: string[], fallback: string): string =>
    list.length === 0 ? fallback : list.slice(0, 3).join(', ') + (list.length > 3 ? '…' : '')
  if (group === 'loans') {
    return names(
      data.loans.map((l) => l.title),
      t('add.loansFallback')
    )
  }
  if (group === 'savings') {
    return names(
      data.goals.map((g) => g.name),
      t('add.savingsFallback')
    )
  }
  return names(
    data.categories
      .filter((c) => c.type === 'expense' && c.group === group && !c.isArchived)
      .map((c) => c.name)
      .sort((a, b) => a.localeCompare(b)),
    group === 'subscriptions' ? t('add.subscriptionsFallback') : t('add.newCategoryFallback')
  )
}
