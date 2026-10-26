import { useState } from 'react'
import { NavLink } from 'react-router'
import { Blocks, PanelLeftClose, PanelLeftOpen, Plus, type LucideIcon } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import { footerScreens, navGroups } from './screens'

const COLLAPSED_KEY = 'sidebar-collapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

function writeCollapsed(value: boolean): void {
  try {
    localStorage.setItem(COLLAPSED_KEY, value ? '1' : '0')
  } catch {
    // Storage unavailable — the sidebar just won't remember its state.
  }
}

function BrandMark(): React.JSX.Element {
  return (
    <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden="true">
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <path
        d="M7 13.5c3-2.4 6-2.4 9 0s6 2.4 9 0M7 19.5c3-2.4 6-2.4 9 0s6 2.4 9 0"
        fill="none"
        strokeWidth="2.4"
        strokeLinecap="round"
        className="stroke-on-primary"
      />
    </svg>
  )
}

interface NavItemProps {
  to: string
  title: string
  icon: LucideIcon
  collapsed: boolean
}

function NavItem({ to, title, icon: Icon, collapsed }: NavItemProps): React.JSX.Element {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      title={collapsed ? title : undefined}
      className={({ isActive }) =>
        cn(
          'flex h-9 items-center gap-3 rounded-control px-3 font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
          collapsed && 'justify-center px-0',
          isActive
            ? 'bg-primary-soft font-semibold text-primary'
            : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
        )
      }
    >
      <Icon className="size-[1.125rem] shrink-0" />
      <span className={cn('truncate', collapsed && 'sr-only')}>{title}</span>
    </NavLink>
  )
}

export function Sidebar({ onAddTransaction }: { onAddTransaction: () => void }): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(readCollapsed)

  const toggle = (): void => {
    setCollapsed((value) => {
      writeCollapsed(!value)
      return !value
    })
  }

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
        {navGroups.map((group, index) => (
          <div key={group.label ?? index} className="grid gap-0.5">
            {group.label &&
              (collapsed ? (
                <hr className="mx-2 mb-1 border-line" />
              ) : (
                <p className="px-3 pb-1 text-xs font-semibold text-ink-muted">{group.label}</p>
              ))}
            {group.screens.map((screen) => (
              <NavItem
                key={screen.path}
                to={screen.path}
                title={screen.title}
                icon={screen.icon}
                collapsed={collapsed}
              />
            ))}
          </div>
        ))}
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
