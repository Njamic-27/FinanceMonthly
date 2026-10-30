import {
  ArrowLeftRight,
  CalendarDays,
  CalendarRange,
  ChartLine,
  ChartPie,
  History,
  Landmark,
  PiggyBank,
  Repeat,
  Settings,
  Tags,
  Wallet,
  type LucideIcon
} from 'lucide-react'
import type { MessageKey } from '@shared/i18n'

export interface Screen {
  path: string
  titleKey: MessageKey
  icon: LucideIcon
}

/** The sidebar: Month, the home screen where everyday use happens, and the two views beside it. */
export const mainScreens: Screen[] = [
  {
    path: '/',
    titleKey: 'screen.month',
    icon: CalendarRange
  },
  {
    path: '/projections',
    titleKey: 'screen.projections',
    icon: ChartLine
  },
  {
    path: '/calendar',
    titleKey: 'screen.calendar',
    icon: CalendarDays
  }
]

/**
 * The small "More" group at the bottom of the sidebar, closed by default: screens kept for
 * looking things up, never needed for everyday use.
 */
export const moreScreens: Screen[] = [
  {
    path: '/transactions',
    titleKey: 'screen.transactions',
    icon: ArrowLeftRight
  },
  {
    path: '/overview',
    titleKey: 'screen.overview',
    icon: ChartPie
  },
  {
    path: '/history',
    titleKey: 'screen.history',
    icon: History
  },
  {
    path: '/accounts',
    titleKey: 'screen.accounts',
    icon: Wallet
  },
  {
    path: '/recurring',
    titleKey: 'screen.recurring',
    icon: Repeat
  },
  {
    path: '/savings',
    titleKey: 'screen.savings',
    icon: PiggyBank
  },
  {
    path: '/loans',
    titleKey: 'screen.loans',
    icon: Landmark
  },
  {
    path: '/categories',
    titleKey: 'screen.categories',
    icon: Tags
  }
]

export const footerScreens: Screen[] = [
  {
    path: '/settings',
    titleKey: 'screen.settings',
    icon: Settings
  }
]

export const allScreens: Screen[] = [...mainScreens, ...moreScreens, ...footerScreens]
