import { Check } from 'lucide-react'
import { paletteColors, type PaletteColor } from '@shared/palette'
import { colorLabel, swatchStyle } from '@renderer/lib/palette'
import { t } from '@renderer/lib/i18n'

interface ColorPickerProps {
  /** Groups the radio buttons; must be unique on the page. */
  name: string
  value: PaletteColor
  onChange: (color: PaletteColor) => void
}

/** A row of palette swatches, built on native radio buttons. */
export function ColorPicker({ name, value, onChange }: ColorPickerProps): React.JSX.Element {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{t('ui.colour')}</legend>
      <div className="flex flex-wrap gap-2.5">
        {paletteColors.map((color) => (
          <label
            key={color}
            title={colorLabel(color)}
            style={swatchStyle(color)}
            className="relative inline-flex size-8 cursor-pointer items-center justify-center rounded-full bg-(color:--swatch) text-white ring-offset-2 ring-offset-surface transition-shadow has-checked:ring-2 has-checked:ring-ink has-focus-visible:outline-2 has-focus-visible:outline-offset-4 has-focus-visible:outline-primary"
          >
            <input
              type="radio"
              name={name}
              value={color}
              checked={value === color}
              onChange={() => onChange(color)}
              aria-label={colorLabel(color)}
              className="peer sr-only"
            />
            <Check className="hidden size-4 peer-checked:block" aria-hidden />
          </label>
        ))}
      </div>
    </fieldset>
  )
}
