import {
  ArrowLeftRight,
  CalendarDays,
  ChartLine,
  ChartPie,
  History,
  Landmark,
  LayoutDashboard,
  PiggyBank,
  Repeat,
  Settings,
  Tags,
  Wallet,
  type LucideIcon
} from 'lucide-react'

export interface Screen {
  path: string
  title: string
  icon: LucideIcon
  description: string
  /** What the finished screen will contain — shown on the placeholder until it is built. */
  features: string[]
  /** Build-plan step (docs/PLAN.md) that delivers the screen. */
  step: number
}

export interface ScreenGroup {
  label?: string
  screens: Screen[]
}

export const navGroups: ScreenGroup[] = [
  {
    screens: [
      {
        path: '/',
        title: 'Dashboard',
        icon: LayoutDashboard,
        description: 'Your money at a glance.',
        features: [
          'Total balance, this month’s income, expenses and net',
          'Income vs expenses for the last 6 months',
          'Spending by category and balance trend',
          'Upcoming bills, savings goals and card usage'
        ],
        step: 17
      },
      {
        path: '/transactions',
        title: 'Transactions',
        icon: ArrowLeftRight,
        description: 'Every payment, income and transfer in one list.',
        features: [
          'Search and filter by date, account, category and type',
          'Grouped by day with daily totals',
          'Add, edit, duplicate and delete transactions'
        ],
        step: 11
      }
    ]
  },
  {
    label: 'Views',
    screens: [
      {
        path: '/overview',
        title: 'Overview',
        icon: ChartPie,
        description: 'One week or one month in detail.',
        features: [
          'Switch between week and month, step back to any past period',
          'Totals compared with the previous period',
          'Daily spending, category breakdown and top expenses'
        ],
        step: 15
      },
      {
        path: '/calendar',
        title: 'Calendar',
        icon: CalendarDays,
        description: 'What happened and what’s coming, day by day.',
        features: [
          'Month grid with income and expense totals per day',
          'Planned bills, income and installments up to 24 months ahead',
          'Month summary with ending balance',
          'Open a day to add a transaction or confirm a planned payment'
        ],
        step: 21
      },
      {
        path: '/history',
        title: 'History',
        icon: History,
        description: 'Past months and weeks side by side.',
        features: [
          'Year grid of months or weeks with income, expenses and net',
          'Yearly chart',
          'Open any period in Overview'
        ],
        step: 16
      },
      {
        path: '/projections',
        title: 'Projections',
        icon: ChartLine,
        description: 'Where your balance is heading over the next 2 years.',
        features: [
          'Weekly or monthly forecast, 3 to 24 months ahead',
          'Based on income, recurring expenses, subscriptions and loan installments',
          'Milestones like loans paid off and goals reached'
        ],
        step: 29
      }
    ]
  },
  {
    label: 'Money',
    screens: [
      {
        path: '/accounts',
        title: 'Accounts',
        icon: Wallet,
        description: 'Debit cards, credit cards and cash.',
        features: [
          'Balance of every account',
          'Credit card limit, used and available amount',
          'Installment purchases and card payments'
        ],
        step: 9
      },
      {
        path: '/recurring',
        title: 'Subscriptions',
        icon: Repeat,
        description: 'Subscriptions, regular bills and regular income.',
        features: [
          'Next billing date and reminder for each subscription',
          'Monthly and yearly cost',
          'Recurring income like your salary'
        ],
        step: 20
      },
      {
        path: '/savings',
        title: 'Savings',
        icon: PiggyBank,
        description: 'Goals and how close you are.',
        features: [
          'Saved vs target for each goal',
          'Deposits and withdrawals',
          'Estimated date you reach each goal'
        ],
        step: 25
      },
      {
        path: '/loans',
        title: 'Loans',
        icon: Landmark,
        description: 'Money you lent, money you borrowed and bank loans.',
        features: [
          'What’s still owed, to you and by you',
          'Bank loan installment schedule',
          'Record repayments and see the payoff date'
        ],
        step: 26
      }
    ]
  }
]

export const footerScreens: Screen[] = [
  {
    path: '/categories',
    title: 'Categories',
    icon: Tags,
    description: 'The categories you sort income and expenses into.',
    features: ['Create, rename and recolour categories', 'Archive categories you no longer use'],
    step: 8
  },
  {
    path: '/settings',
    title: 'Settings',
    icon: Settings,
    description: 'Currency, theme, reminders and backups.',
    features: [
      'Currency, number format and first day of the week',
      'Light, dark or system theme',
      'Reminders, backups and data export'
    ],
    step: 7
  }
]

export const allScreens: Screen[] = [...navGroups.flatMap((g) => g.screens), ...footerScreens]
