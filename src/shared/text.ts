/**
 * Letters that are separate letters rather than a base letter plus an accent, so Unicode
 * decomposition leaves them alone. Folded by hand so "dakovo" finds "Đakovo".
 */
const standalone: Record<string, string> = {
  đ: 'd',
  ð: 'd',
  ł: 'l',
  ø: 'o',
  ß: 'ss',
  æ: 'ae',
  œ: 'oe',
  ı: 'i',
  þ: 'th'
}
const standalonePattern = new RegExp(`[${Object.keys(standalone).join('')}]`, 'g')

/**
 * Text for matching regardless of case and diacritics: "Doručak" and "DORUCAK" both fold to
 * "dorucak". Used on both sides of a search; never stored or shown.
 */
export function foldText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(standalonePattern, (c) => standalone[c])
}
