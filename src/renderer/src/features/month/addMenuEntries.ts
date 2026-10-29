import type { LoanKind } from '@shared/loans'
import type { MonthLineType } from '@shared/month'
import { foldText } from '@shared/text'
import type { AddChoice } from './cells'

// What "+" on Income or Expenses offers (PLAN.md §3, Month): a category to add to, picked or
// created by name, and under Expenses everything else that takes money out, each opening its
// dialog on Month.

export type AddAction =
  /** Something in a category, one-time or recurring: an existing one by name, or a new one. */
  | { kind: 'line'; type: MonthLineType; name: string; isNew: boolean }
  /** A dialog that adds something new: a subscription, card, loan, goal or account. */
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
  categories: { id: number; name: string; type: MonthLineType; isArchived: boolean }[]
  /** Active credit cards. */
  cards: { id: number; name: string }[]
  /** Active loans. */
  loans: { id: number; title: string; kind: LoanKind }[]
  /** Active savings goals. */
  goals: { id: number; name: string; saved: number }[]
}

const loanLabels: Record<LoanKind, (title: string) => string> = {
  bank_loan: (title) => `Pay ${title} installment`,
  borrowed: (title) => `Repay ${title}`,
  lent: (title) => `Repayment of ${title}`
}

/**
 * The menu for one section, filtered by what's typed (ignoring case and accents). Typing a
 * name no category has offers to create it; an archived one is offered back by its exact name.
 */
export function addMenu(
  section: 'income' | 'expenses',
  query: string,
  data: AddMenuData
): AddGroup[] {
  const type: MonthLineType = section === 'income' ? 'income' : 'expense'
  const typed = query.trim()
  const needle = foldText(typed)
  const matches = (...texts: string[]): boolean =>
    needle === '' || texts.some((text) => foldText(text).includes(needle))

  const ofType = data.categories.filter((c) => c.type === type)
  const exact = ofType.find((c) => foldText(c.name) === needle)
  const categories: AddEntry[] = [
    ...(typed && !exact
      ? [
          {
            key: 'create',
            label: `Create “${typed}”`,
            description: `A new ${type} category`,
            action: { kind: 'line', type, name: typed, isNew: true } as const
          }
        ]
      : []),
    ...ofType
      .filter((c) => (c.isArchived ? c === exact : matches(c.name)))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c): AddEntry => ({
        key: `category-${c.id}`,
        label: c.name,
        description: c.isArchived ? 'Archived; adding to it restores it' : undefined,
        action: { kind: 'line', type, name: c.name, isNew: false }
      }))
  ]
  const groups: AddGroup[] = [{ heading: 'Categories', entries: categories }]

  if (section === 'expenses') {
    const open = (choice: AddChoice, label: string, description?: string): AddEntry => ({
      key: choice,
      label,
      description,
      action: { kind: 'open', choice }
    })
    groups.push(
      {
        heading: 'Bills & subscriptions',
        entries: [open('subscription', 'Subscription', 'Netflix, Spotify and the like')]
      },
      {
        heading: 'Credit cards',
        entries: [
          open('installments', 'Buy in installments', 'A purchase on a card, paid off monthly'),
          ...data.cards.map((card): AddEntry => ({
            key: `card-${card.id}`,
            label: `Pay ${card.name}`,
            description: 'Moving money to the card, not spending',
            action: { kind: 'pay_card', accountId: card.id }
          })),
          open('card', 'Add a credit card')
        ]
      },
      {
        heading: 'Loans',
        entries: [
          ...data.loans.map((loan): AddEntry => ({
            key: `loan-${loan.id}`,
            label: loanLabels[loan.kind](loan.title),
            action: { kind: 'loan', loanId: loan.id }
          })),
          open('bank_loan', 'Bank loan', 'Paid back in installments'),
          open('borrowed', 'Money borrowed', 'From a friend or family'),
          open('lent', 'Money lent', 'To a friend or family')
        ]
      },
      {
        heading: 'Savings',
        entries: [
          ...data.goals.flatMap((goal): AddEntry[] => [
            {
              key: `deposit-${goal.id}`,
              label: `Put into ${goal.name}`,
              action: { kind: 'savings', goalId: goal.id, movement: 'deposit' }
            },
            ...(goal.saved > 0
              ? [
                  {
                    key: `withdrawal-${goal.id}`,
                    label: `Take out of ${goal.name}`,
                    action: { kind: 'savings', goalId: goal.id, movement: 'withdrawal' } as const
                  }
                ]
              : [])
          ]),
          open('goal', 'New savings goal')
        ]
      },
      {
        heading: 'Accounts',
        entries: [
          open('transfer', 'Move money between accounts', 'A cash withdrawal, a transfer'),
          open('account', 'Add an account or card')
        ]
      }
    )
  }

  return groups
    .map((group, i) => ({
      ...group,
      // Categories are filtered above; the rest by their own words or their group's.
      entries:
        i === 0
          ? group.entries
          : group.entries.filter((e) => matches(e.label, e.description ?? '', group.heading))
    }))
    .filter((group) => group.entries.length > 0)
}
