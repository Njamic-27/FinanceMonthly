import { Link, useLocation, useNavigate } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { canGoBack } from '@renderer/lib/history'
import { t } from '@renderer/lib/i18n'
import { cn } from '@renderer/lib/utils'

const backClass =
  'mb-3 inline-flex items-center gap-1.5 rounded-control text-sm font-semibold text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-primary'

/**
 * "Back" to where you were (also Alt+Left and the mouse's back button). With nowhere to go
 * back to, it offers `fallback`, the screen this one belongs to, or keeps its space empty.
 */
export function BackButton({
  fallback
}: {
  fallback?: { to: string; label: string }
}): React.JSX.Element {
  const navigate = useNavigate()
  // Re-reads the history position whenever the location changes.
  useLocation()

  if (canGoBack()) {
    return (
      <button
        type="button"
        onClick={() => navigate(-1)}
        title={t('shell.backShortcut')}
        className={cn(backClass, 'cursor-pointer')}
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t('shell.back')}
      </button>
    )
  }
  if (fallback) {
    return (
      <Link to={fallback.to} className={backClass}>
        <ArrowLeft className="size-4" aria-hidden />
        {fallback.label}
      </Link>
    )
  }
  // Holds the line, so the title doesn't move once there is somewhere to go back to.
  return (
    <span aria-hidden className={cn(backClass, 'invisible')}>
      {t('shell.back')}
    </span>
  )
}
