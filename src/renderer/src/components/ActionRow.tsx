interface ActionRowProps {
  title: string
  description: string
  children?: React.ReactNode
}

/** A titled, explained action in a settings-style list, with its button on the right. */
export function ActionRow({ title, description, children }: ActionRowProps): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-sm text-ink-muted">{description}</p>
      </div>
      {children}
    </div>
  )
}
