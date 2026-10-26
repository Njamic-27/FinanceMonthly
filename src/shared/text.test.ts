import { describe, expect, it } from 'vitest'
import { foldText } from './text'

describe('foldText', () => {
  it.each([
    ['Čokolada', 'cokolada'],
    ['DORUČAK', 'dorucak'],
    ['Ćevapi', 'cevapi'],
    ['ŽUTO', 'zuto'],
    ['Šljive', 'sljive'],
    ['Đakovo', 'dakovo'],
    ['đuveč', 'duvec'],
    ['Crème brûlée', 'creme brulee'],
    ['Łódź', 'lodz'],
    ['Øresund', 'oresund'],
    ['Straße', 'strasse'],
    ['50% off_now', '50% off_now']
  ])('folds %j to %j', (input, folded) => {
    expect(foldText(input)).toBe(folded)
  })

  it('makes upper and lower case, with and without accents, equal', () => {
    expect(foldText('ČĆŽŠĐ')).toBe(foldText('čćžšđ'))
    expect(foldText('čćžšđ')).toBe('cczsd')
  })
})
