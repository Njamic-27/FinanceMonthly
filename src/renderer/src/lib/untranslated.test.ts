import { readdirSync, readFileSync } from 'fs'
import { join, relative } from 'path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

// No English left in the renderer (PLAN.md step 54): every text a person reads goes through
// t(), so it follows the language switch. This reads each file's syntax tree and reports JSX
// text, and strings or templates with words in them where a person would see them.

const ROOT = join(__dirname, '..')

/** Words that stay as they are in every language. */
const ALLOWED = new Set(['Financije'])

/** Props and fields whose value is shown to people. */
const USER_FACING = new Set([
  'title',
  'caption',
  'description',
  'label',
  'hint',
  'placeholder',
  'aria-label',
  'aria-valuetext',
  'action',
  'confirmLabel',
  'heading',
  'note',
  'error',
  'message',
  'empty',
  'text'
])

/** Calls whose string arguments aren't shown: classes, keys, storage, queries. */
const QUIET_CALLS =
  /^(t|tNode|cn|require|.*\.(get|set|getItem|setItem|includes|startsWith|endsWith|querySelector|split|join|replace))$/

const hasWords = (text: string): boolean =>
  /[A-Za-z]{2,}[ ’'][A-Za-z]/.test(text) || /^[A-Z][a-z]/.test(text.trim())

/** A class list, a CSS value or a path, not a sentence. */
const isCode = (text: string): boolean =>
  text.includes('var(--') ||
  text
    .trim()
    .split(/\s+/)
    .every((word) => /^[a-z0-9:[\]\-./()%_#&>=!,]+$/.test(word) && /[-:/]/.test(word)) ||
  /^[a-z][a-zA-Z]*$/.test(text)

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'dev' ? [] : sourceFiles(path)
    return /\.tsx?$/.test(entry.name) && !/\.test\.ts$|\.d\.ts$/.test(entry.name) ? [path] : []
  })
}

function quietCall(node: ts.Node): boolean {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isCallExpression(p)) return QUIET_CALLS.test(p.expression.getText())
    if (ts.isJsxAttribute(p) || ts.isPropertyAssignment(p)) return false
  }
  return false
}

function shown(node: ts.Node): boolean {
  const parent = node.parent
  if (ts.isBinaryExpression(parent) && /^[!=]==?$/.test(parent.operatorToken.getText())) {
    return false
  }
  if (ts.isCaseClause(parent) || ts.isLiteralTypeNode(parent)) return false
  for (let p: ts.Node | undefined = parent; p; p = p.parent) {
    if (ts.isJsxAttribute(p)) return USER_FACING.has(p.name.getText())
    if (ts.isPropertyAssignment(p)) return USER_FACING.has(p.name.getText())
    if (ts.isJsxExpression(p) || ts.isReturnStatement(p) || ts.isArrowFunction(p)) return true
    if (ts.isCallExpression(p)) return false
  }
  return false
}

function untranslated(path: string, text = readFileSync(path, 'utf8')): string[] {
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const found: string[] = []
  const report = (node: ts.Node): void => {
    const line = file.getLineAndCharacterOfPosition(node.getStart()).line + 1
    found.push(
      `${relative(ROOT, path)}:${line}: ${node.getText().replace(/\s+/g, ' ').slice(0, 80)}`
    )
  }
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isTypeNode(node)) return
    if (ts.isJsxText(node)) {
      const words = node.getText().trim()
      if (/[A-Za-z]{2,}/.test(words) && !ALLOWED.has(words)) report(node)
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (hasWords(node.text) && !isCode(node.text) && !quietCall(node) && shown(node)) {
        report(node)
      }
    } else if (ts.isTemplateExpression(node)) {
      const parts = [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join(' ')
      if (
        /[A-Za-z]{2,} [A-Za-z]{2,}|^[A-Z][a-z]+ /.test(parts) &&
        !isCode(parts) &&
        !quietCall(node)
      ) {
        report(node)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return found
}

describe('the renderer', () => {
  it('has no English text outside t()', () => {
    expect(sourceFiles(ROOT).flatMap((path) => untranslated(path))).toEqual([])
  })

  it('would notice English text', () => {
    const check = (code: string): number => untranslated(join(ROOT, 'sample.tsx'), code).length
    expect(check('const a = <p>Money out</p>')).toBe(1)
    expect(check('const a = <Button title="Pay the bill" />')).toBe(1)
    expect(check("toast({ title: 'Payment saved' })")).toBe(1)
    expect(check('const a = <p>{`Show ${n} more`}</p>')).toBe(1)
    expect(check("const a = <p title={t('month.payBill')}>{t('month.moneyOut')}</p>")).toBe(0)
    expect(
      check('const a = <p className="flex items-center gap-2">{cn(\'px-2 text-sm\')}</p>')
    ).toBe(0)
    expect(check("if (event.key === 'Enter') save()")).toBe(0)
  })
})
