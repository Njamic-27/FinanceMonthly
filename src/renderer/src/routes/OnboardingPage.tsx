import { Link } from 'react-router'
import { Button } from '@renderer/components/ui/button'

/** First-run setup. Placeholder until step 14. */
export function OnboardingPage(): React.JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <section className="w-full max-w-lg rounded-panel border border-line bg-surface p-8">
        <h1 className="text-[2rem] leading-tight font-bold">Welcome to Financije</h1>
        <p className="mt-2 text-ink-muted">
          First-run setup arrives in step 14: choose your currency and first day of the week, add
          your accounts with their current balances, and review the starting categories.
        </p>
        <Button asChild className="mt-6">
          <Link to="/">Go to dashboard</Link>
        </Button>
      </section>
    </div>
  )
}
