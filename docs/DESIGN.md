# Design system — "Adriatic pocketbook"

Calm and friendly, for one person keeping track of their own money. Amounts are the hero: big,
confident numbers set in a display face. Everything around them stays quiet.

Tokens live in `src/renderer/src/assets/main.css`; components in `src/renderer/src/components/ui`.

## Colour

| Token                   | Light                 | Dark                  | Use                                     |
| ----------------------- | --------------------- | --------------------- | --------------------------------------- |
| `canvas`                | `#f3f6f8`             | `#0e1a24`             | App background (cool, not cream)        |
| `surface` / `surface-2` | `#ffffff` / `#eaf0f3` | `#152331` / `#1c2d3d` | Panels / hover, segmented controls      |
| `ink` / `ink-muted`     | `#17263a` / `#5b6b7f` | `#e7eef4` / `#93a4b5` | Text                                    |
| `line`                  | `#dde4ea`             | `#26394b`             | Borders, dividers                       |
| `primary`               | `#0b6e8a` (Adriatic)  | `#4db6d0`             | Actions, focus, the balance panel       |
| `banner`                | `#0b6e8a`             | `#0f4f66`             | The one bold panel per screen (balance) |
| `income`                | `#1f8f62` (pine)      | `#4cc994`             | Money in                                |
| `expense`               | `#d64545` (poppy)     | `#f07a6e`             | Money out, destructive actions, errors  |
| `savings`               | `#b97f0c` (sunflower) | `#f0bd4f`             | Savings goals                           |
| `loan`                  | `#6352d6` (iris)      | `#a497f2`             | Loans and debt                          |

Each money colour has a `-soft` tint for backgrounds (chips, tiles). Money colours mean money
kinds only — never use them as decoration.

**Palette colours** (`--swatch-*`, chosen per category or account, stored by name) are a separate
categorical set that avoids the money hues: blue, orange, aqua, plum, olive, pink, brown, sky,
plus neutral slate for "Other". Each has its own light and dark step. In this order, every
neighbouring pair passes the colour-vision-deficiency and contrast checks on `surface` in both
themes, so new categories and accounts take the next unused colour in this order. With more than eight
categories some colours repeat, so charts fold small categories into "Other" rather than
relying on colour alone. Chips use the colour at 15% for the background and the full colour for
the icon; the name beside them stays in `ink`.

## Type

- **Figtree** (variable) — UI and body text, 15px base (`text-body`).
- **Bricolage Grotesque** (variable) — headings and amounts. Use the `amount` utility for any
  money value: display face, tabular figures, tight tracking.
- Scale: `text-sm` 14 · `text-body` 15 · `text-lg` 18 · `text-title` 22 · `text-amount` 32 · `text-hero` 46.
- Sentence case everywhere. No all-caps labels.

## Shape and depth

- Radius by hierarchy: `rounded-control` (10px) for inputs/buttons, `rounded-panel` (18px) for
  panels and dialogs, `rounded-full` for segmented controls and chips.
- Panels are flat: a 1px `line` border, no shadow. Only floating layers (dialogs, menus, toasts)
  get `shadow-float`.

## Motion

Only in response to an action: dialogs, menus and toasts animate in. No entrance animations on
page content. `prefers-reduced-motion` disables all of it.

## Links

Anything that mentions something else opens it, from every screen: a day → that day in the
Calendar, a week or month → Overview (future periods → Calendar), an account → its page, a
category → Transactions filtered to it (and the period, if any), a transaction → its edit
dialog, a recurring item → its edit dialog on Recurring, a goal or loan → its page. A planned
payment, and every reminder, opens its **row on Month** (`/?month=…&row=kind:id`), where it's
paid or confirmed. Paths are built in `src/renderer/src/lib/links.ts` and `monthRowPath` in
`src/shared/month.ts`; never hand-write them.

## Month first

Everyday use happens on Month; the screens under "More" are for looking things up. Anything
done every day — adding, confirming, paying, correcting a balance, editing or deleting — is
reachable from Month without leaving it: "+" on Income and Expenses, a row's side panel
(`DialogContent side`), Waiting for you, and Your accounts. A link to another screen from Month
is only ever an extra ("Open full page").

- `link` — a reference in text: primary and underlined on hover.
- `link-row` — a row or tile that opens as a whole: `surface-2` background on hover.
- `link-cover` — a row's main button when the row also holds links: it covers the row
  (`relative`), and `link`s inside sit above it.
- Back (above every page, Alt+Left, the mouse's back button) returns to where you were; with
  no history a detail page offers its parent screen instead.

## Writing

Buttons name the action ("Save transaction", not "Submit"); the toast repeats it ("Transaction
saved"). Errors say what's wrong and how to fix it. Empty states invite the next action.
