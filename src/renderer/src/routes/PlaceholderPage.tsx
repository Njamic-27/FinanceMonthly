import type { Screen } from '@renderer/app/screens'
import { PageHeader } from '@renderer/components/PageHeader'

export function PlaceholderPage({ screen }: { screen: Screen }): React.JSX.Element {
  const Icon = screen.icon
  return (
    <>
      <PageHeader title={screen.title} description={screen.description} />
      <section className="flex max-w-2xl gap-5 rounded-panel border border-dashed border-line p-6">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Icon className="size-6" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">Not built yet</h2>
          <p className="mt-1 text-ink-muted">
            This screen arrives in step {screen.step}. It will show:
          </p>
          <ul className="mt-3 grid list-disc gap-1.5 pl-5 marker:text-primary">
            {screen.features.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        </div>
      </section>
    </>
  )
}
