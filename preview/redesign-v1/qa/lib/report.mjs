// results.json + generated summary.md
import fs from 'node:fs'
import path from 'node:path'
import { OUT_DIR } from './util.mjs'

const SEV = ['error', 'warn', 'info']

export function writeReports(r) {
  fs.writeFileSync(path.join(OUT_DIR, 'results.json'), JSON.stringify(r, null, 1))
  fs.writeFileSync(path.join(OUT_DIR, 'summary.md'), summary(r))
}

export function totals(findings) {
  const t = {}
  for (const f of findings) {
    t[f.check] ??= { error: 0, warn: 0, info: 0 }
    t[f.check][f.severity] = (t[f.check][f.severity] || 0) + 1
  }
  return t
}

function esc(s) {
  return String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

function summary(r) {
  const L = []
  const t = totals(r.findings)
  L.push(`# QA run summary`, '')
  L.push(`- Started: ${r.startedAt}  ·  duration ${Math.round(r.durationMs / 1000)}s  ·  ${r.aborted ? '**ABORTED: ' + r.aborted + '**' : 'completed'}`)
  L.push(`- Target: ${r.target.kind} — ${r.target.url}${r.target.note ? ' (' + r.target.note + ')' : ''}`)
  L.push(`- Browser: ${r.browser}  ·  suites: ${r.suites.join(', ')}${r.quick ? ' (quick)' : ''}`)
  L.push(`- Cases: ${r.cases.length} run of ${r.plannedCases} planned  ·  crashed: ${r.cases.filter((c) => c.status === 'crashed').length}`)
  L.push('', '> Results are on mock data in a prototype. They are not a production acceptance.', '')

  L.push('## Findings by check', '', '| check | error | warn | info |', '|---|---:|---:|---:|')
  for (const [k, v] of Object.entries(t).sort()) L.push(`| ${k} | ${v.error || 0} | ${v.warn || 0} | ${v.info || 0} |`)
  if (!Object.keys(t).length) L.push('| (none) | 0 | 0 | 0 |')

  const byCase = new Map()
  for (const f of r.findings) if (f.severity === 'error') byCase.set(f.case, (byCase.get(f.case) || 0) + 1)
  L.push('', '## Cases with errors', '')
  if (!byCase.size) L.push('None.')
  else {
    L.push('| case | errors | first error |', '|---|---:|---|')
    for (const [c, n] of [...byCase].sort((a, b) => b[1] - a[1]).slice(0, 60)) {
      const f = r.findings.find((x) => x.case === c && x.severity === 'error')
      L.push(`| ${esc(c)} | ${n} | ${esc(f.check)}: ${esc(f.detail).slice(0, 140)} |`)
    }
  }

  if (r.flows?.length) {
    L.push('', '## Flows', '', '| flow | status | steps ok | failed steps |', '|---|---|---:|---|')
    for (const f of r.flows) {
      const bad = f.steps.filter((s) => !s.ok)
      L.push(`| ${f.name} | ${f.status} | ${f.steps.length - bad.length}/${f.steps.length} | ${esc(bad.map((s) => `${s.name} — ${s.detail}`).join('<br>')).slice(0, 900)} |`)
    }
  }

  if (r.perf) {
    const demo = r.perfDemo ? Object.fromEntries(r.perfDemo.table.map((x) => [x.metric, x])) : {}
    L.push('', '## Performance (M6)', '', '| metric | budget | full | status | demo | status |', '|---|---:|---:|---|---:|---|')
    for (const p of r.perf.table) L.push(`| ${p.label} | ≤ ${p.budget} | ${p.value ?? '—'} | ${p.status} | ${demo[p.metric]?.value ?? '—'} | ${demo[p.metric]?.status ?? '—'} |`)
    const m = r.perf.metrics
    L.push('', `FCP ${m.fcpMs ?? '—'}ms · DCL ${m.dclMs ?? '—'}ms · palette median ${m.paletteKeyMedian ?? '—'}ms · route switch median (warm) ${m.routeSwitchMedian ?? '—'}ms, p95 cold ${m.routeSwitchColdP95 ?? '—'}ms · max DOM nodes ${m.maxDomNodes ?? '—'} · JS heap ${m.jsHeapMB ?? '—'} MB`)
    if (r.perf.notes.length) L.push('', ...r.perf.notes.map((n) => `- note: ${n}`))
  }

  if (r.special) {
    L.push('', '## Theme flash / reduced motion', '')
    for (const x of r.special.themeFlash || []) L.push(`- theme flash · ${x.scenario} · ${x.route}: data-theme=${x.theme}, html bg ${x.bg} → ${x.ok ? 'ok' : '**FLASH**'}`)
    for (const x of r.special.reducedMotion || []) L.push(`- reduced motion · ${x.variant} · ${x.route}: ${x.infinite} infinite animation(s), html[data-motion]=${x.dataMotion}`)
  }

  L.push('', '## Verified in a real browser (this run)', '')
  for (const v of r.verified) L.push(`- ${v}`)
  L.push('', '## Not verified automatically', '')
  for (const v of NOT_AUTOMATED) L.push(`- ${v}`)
  return L.join('\n') + '\n'
}

export const NOT_AUTOMATED = [
  'Visual quality, hierarchy and module rhythm (V1–V12) — review screenshots by eye.',
  'Contrast of text over gradients, images and absolutely positioned overlays (reported as unknown background).',
  'Placeholder, SVG chart-axis and canvas text contrast.',
  'Soft-keyboard avoidance with visualViewport (P9) — needs a real phone.',
  'Real touch scrolling / momentum, and IME composition in the palette.',
  'Screen-reader output (aria-live announcements, reading order).',
  'Font fallback and CJK glyph selection (lang-specific shapes) — by eye on screenshots.',
]
