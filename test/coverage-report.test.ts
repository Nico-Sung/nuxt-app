import { describe, expect, it } from 'vitest'
import {
  badgeColor,
  badgeSvg,
  formatPct,
  reportMarkdown,
} from '../scripts/coverage-report.mjs'

const metric = (covered: number, total: number) => ({
  covered,
  total,
  pct: total ? Math.round((covered / total) * 10000) / 100 : 'Unknown',
})
const metrics = (covered: number, total: number) => ({
  lines: metric(covered, total),
  statements: metric(covered, total),
  functions: metric(covered, total),
  branches: metric(covered, total),
})

describe('badge de couverture', () => {
  it.each([
    [95, '#4c1'],
    [85, '#97ca00'],
    [72, '#a4a61d'],
    [65, '#dfb317'],
    [55, '#fe7d37'],
    [30, '#e05d44'],
  ])('%s %% -> couleur %s', (value, color) => {
    expect(badgeColor(value)).toBe(color)
  })

  it('format français', () => {
    expect(formatPct(90.75)).toBe('90,8 %')
    expect(formatPct(100)).toBe('100 %')
  })

  it('SVG : libellé, taux et couleur', () => {
    const svg = badgeSvg('coverage API', 93.3)
    expect(svg).toContain('<svg')
    expect(svg).toContain('>coverage API<')
    expect(svg).toContain('>93,3 %<')
    expect(svg).toContain('fill="#4c1"')
    expect(svg).toContain('aria-label="coverage API: 93,3 %"')
  })

  it('échappe les caractères XML du libellé', () => {
    expect(badgeSvg('a & <b>', 50)).toContain('a &amp; &lt;b&gt;')
  })
})

describe('rapport Markdown', () => {
  const summary = {
    total: metrics(90, 100),
    '/repo/src/bien.ts': metrics(10, 10),
    '/repo/src/moyen.ts': metrics(8, 10),
    '/repo/src/faible.ts': metrics(2, 10),
  }

  it('total, puis les fichiers du moins au plus couvert', () => {
    const md = reportMarkdown('API', summary, '/repo')
    expect(md).toContain('### Couverture API : 90 % des lignes')
    expect(md).toContain('| **Total** | 90 % (90/100) |')
    const order = ['faible', 'moyen', 'bien'].map((f) =>
      md.indexOf(`src/${f}.ts`),
    )
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  it('limite le nombre de fichiers listés', () => {
    const md = reportMarkdown('API', summary, '/repo', 2)
    expect(md).toContain('Les 2 fichiers les moins couverts (sur 3)')
    expect(md).not.toContain('src/bien.ts')
  })

  it('refuse un résumé sans total', () => {
    expect(() => reportMarkdown('API', {}, '/repo')).toThrow('sans "total"')
  })
})
