/** A field's validation message; give it the id the field's aria-describedby points at. */
export function FieldError({
  id,
  message
}: {
  id: string
  message?: string
}): React.JSX.Element | null {
  if (!message) return null
  return (
    <p id={id} className="text-sm text-expense">
      {message}
    </p>
  )
}
