import { cn } from '@renderer/lib/utils'

/**
 * How far along a goal is, as a ring in the savings colour with the percentage inside. Past
 * the target the ring stays full.
 */
export function ProgressRing({
  share,
  size = 72,
  label,
  className
}: {
  /** 0 to 1; more than 1 past the target. */
  share: number
  size?: number
  /** Read out by screen readers, e.g. "60% of €2,000.00 saved". */
  label: string
  className?: string
}): React.JSX.Element {
  const stroke = Math.max(6, Math.round(size / 10))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const filled = Math.min(1, Math.max(0, share))
  const percent = Math.floor(share * 100)

  return (
    <div
      role="img"
      aria-label={label}
      className={cn('relative shrink-0', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--savings)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled * circumference} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span
        aria-hidden
        className="amount absolute inset-0 flex items-center justify-center"
        style={{ fontSize: Math.max(12, size / 4.5) }}
      >
        {percent}%
      </span>
    </div>
  )
}
