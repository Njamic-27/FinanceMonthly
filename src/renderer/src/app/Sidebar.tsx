import { useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import {
  Blocks,
  ChevronDown,
  Ellipsis,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  type LucideIcon
} from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import { BrandMark } from '@renderer/components/BrandMark'
import { useDueOccurrences } from '@renderer/features/recurring/queries'
import { footerScreens, mainScreens, moreScreens } from './screens'

const COLLAPSED_KEY = 'sidebar-collapsed'
const MORE_OPEN_KEY = 'sidebar-more-open'

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeFlag(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? '1' : '0')
  } catch {
    // Storage unavailable — the sidebar just won't remember its state.
  }
}

const itemClass =
  'flex h-9 items-center gap-3 rounded-control px-3 font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary'

type Badge = { count: number; label: string }

/** A count of things waiting: a pill, or a dot on the icon while the sidebar is collapsed. */
function BadgePill({ badge, collapsed }: { badge: Badge; collapsed: boolean }): React.JSX.Element {
  return (
    <span
      className={cn(
        'ml-auto rounded-full bg-primary px-1.5 text-xs leading-5 font-semibold text-on-primary tabular-nums',
        collapsed && 'sr-only'
      )}
      title={badge.label}
    >
      {badge.count}
      <span className="sr-only"> {badge.label}</span>
    </span>
  )
}

function BadgeDot(): React.JSX.Element {
  return <span className="absolute -top-1 -right-1 size-2 rounded-full bg-primary" aria-hidden />
}

interface NavItemProps {
  to: string
  title: string
  icon: LucideIcon
  collapsed: boolean
  /** Things waiting for the user on that screen, e.g. payments due. */
  badge?: Badge
}

function NavItem({ to, title, icon: Icon, collapsed, badge }: NavItemProps): React.JSX.Element {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      title={collapsed ? title : undefined}
      className={({ isActive }) =>
        cn(
          itemClass,
          collapsed && 'justify-center px-0',
          isActive
            ? 'bg-primary-soft font-semibold text-primary'
            : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
        )
      }
    >
      <span className="relative shrink-0">
        <Icon className="size-[1.125rem]" />
        {badge && collapsed && <BadgeDot />}
      </span>
      <span className={cn('truncate', collapsed && 'sr-only')}>{title}</span>
      {badge && <BadgePill badge={badge} collapsed={collapsed} />}
    </NavLink>
  )
}

export function Sidebar({ onAddTransaction }: { onAddTransaction: () => void }): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(() => readFlag(COLLAPSED_KEY))
  const [moreOpen, setMoreOpen] = useState(() => readFlag(MORE_OPEN_KEY))
  const { pathname } = useLocation()
  const dueCount = useDueOccurrences().data?.length ?? 0
  const due: Badge | undefined = dueCount > 0 ? { count: dueCount, label: 'due now' } : undefined
  // Payments waiting to be confirmed are confirmed on Month.
  const badges: Record<string, Badge | undefined> = { '/': due }
  // While More is closed, it shows that you're on one of its screens.
  const inMore = moreScreens.some((s) => pathname === s.path || pathname.startsWith(`${s.path}/`))

  const toggle = (): void => {
    setCollapsed((value) => {
      writeFlag(COLLAPSED_KEY, !value)
      return !value
    })
  }
  const toggleMore = (): void => {
    setMoreOpen((value) => {
      writeFlag(MORE_OPEN_KEY, !value)
      return !value
    })
  }

  const item = (screen: (typeof mainScreens)[number]): React.JSX.Element => (
    <NavItem
      key={screen.path}
      to={screen.path}
      title={screen.title}
      icon={screen.icon}
      collapsed={collapsed}
      badge={badges[screen.path]}
    />
  )

  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200',
        collapsed ? 'w-[4.5rem] px-3' : 'w-64 px-4'
      )}
    >
      <div className={cn('flex h-15 items-center gap-2.5', collapsed ? 'justify-center' : 'px-1')}>
        <BrandMark />
        {!collapsed && (
          <span className="font-display text-xl font-bold tracking-tight">Financije</span>
        )}
      </div>

      <Button
        onClick={onAddTransaction}
        size={collapsed ? 'icon' : 'md'}
        className={cn('mb-4', collapsed ? 'self-center' : 'w-full')}
        title={collapsed ? 'Add transaction (Ctrl+N)' : undefined}
        aria-label={collapsed ? 'Add transaction' : undefined}
      >
        <Plus />
        {!collapsed && 'Add transaction'}
      </Button>

      <nav
        className="-mx-1 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1"
        aria-label="Main"
      >
        <div className="grid gap-0.5">{mainScreens.map(item)}</div>
        {/* Out of the way at the bottom, just above Settings; it opens upwards. */}
        <div className="mt-auto grid gap-0.5 pt-3">
          {moreOpen && (
            <div id="sidebar-more" className="grid gap-0.5">
              {moreScreens.map(item)}
            </div>
          )}
          <button
            type="button"
            onClick={toggleMore}
            aria-expanded={moreOpen}
            aria-controls="sidebar-more"
            title={collapsed ? (moreOpen ? 'Fewer screens' : 'More screens') : undefined}
            className={cn(
              itemClass,
              'cursor-pointer text-ink-muted hover:bg-surface-2 hover:text-ink',
              collapsed && 'justify-center px-0',
              inMore && !moreOpen && 'text-primary'
            )}
          >
            <span className="relative shrink-0">
              <Ellipsis className="size-[1.125rem]" />
            </span>
            <span className={cn('truncate', collapsed && 'sr-only')}>More</span>
            {!collapsed && (
              <ChevronDown
                className={cn(
                  'ml-auto size-4 shrink-0 transition-transform motion-reduce:transition-none',
                  !moreOpen && 'rotate-180'
                )}
                aria-hidden
              />
            )}
          </button>
        </div>
      </nav>

      <div className="grid gap-0.5 border-t border-line py-2.5">
        {footerScreens.map((screen) => (
          <NavItem
            key={screen.path}
            to={screen.path}
            title={screen.title}
            icon={screen.icon}
            collapsed={collapsed}
          />
        ))}
        {import.meta.env.DEV && (
          <NavItem to="/dev/ui" title="UI kit" icon={Blocks} collapsed={collapsed} />
        )}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : undefined}
          className={cn(
            'flex h-9 cursor-pointer items-center gap-3 rounded-control px-3 font-medium text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
            collapsed && 'justify-center px-0'
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-[1.125rem]" />
          ) : (
            <>
              <PanelLeftClose className="size-[1.125rem]" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
