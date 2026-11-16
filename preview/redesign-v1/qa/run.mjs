#!/usr/bin/env node
// Real-browser QA harness for Taiko Viewer Design V1.1 (doc 07 §Q).
// node qa/run.mjs [--suite visual|checks|flows|perf|all] [--base URL] [--quick] [--only <substr>]
//                 [--max-minutes 25] [--no-build] [--build-retries 3] [--build-wait 60] [--flows a,b]
import fs from 'node:fs'
import path from 'node:path'
import { buildMatrix } from './matrix.mjs'
import { build, startPreview, stopServer, portFree } from './lib/server.mjs'
import { launchBrowser } from './lib/browser.mjs'
import { runCase } from './lib/cases.mjs'
import { themeFlash, reducedMotion } from './lib/special.mjs'
import { runFlow } from './lib/flowkit.mjs'
import { runPerf } from './lib/perf.mjs'
import { writeReports, totals } from './lib/report.mjs'
import { FLOWS } from './flows/index.mjs'
import { ROOT, OUT_DIR, SHOTS_DIR, ensureDir, openLog, closeLog, log, dirSize, mb, withTimeout } from './lib/util.mjs'

function parseArgs(argv) {
  const a = { suite: 'all', base: null, quick: false, v13: false, variant: 'a', only: null, maxMinutes: 25, build: true, buildRetries: 3, buildWait: 60, flows: null, port: 4311, concurrency: 2 }
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i]
    const v = () => argv[++i]
    if (k === '--suite') a.suite = v()
    else if (k === '--base') a.base = v()
    else if (k === '--quick') a.quick = true
    else if (k === '--variant') a.variant = v() // perf suite only: run the budgets on variant b / c
    else if (k === '--v13') a.v13 = true // V1.3 Phase A targeted checks: four pages, variants B / C, data=real
    else if (k === '--only') a.only = v()
    else if (k === '--max-minutes') a.maxMinutes = Number(v())
    else if (k === '--no-build') a.build = false
    else if (k === '--build-retries') a.buildRetries = Number(v())
    else if (k === '--build-wait') a.buildWait = Number(v())
    else if (k === '--flows') a.flows = v().split(',')
    else if (k === '--port') a.port = Number(v())
    else if (k === '--concurrency') a.concurrency = Math.max(1, Math.min(2, Number(v())))
    else if (k === '--help' || k === '-h') {
      console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 5).join('\n'))
      process.exit(0)
    } else throw new Error('unknown option ' + k)
  }
  const all = ['visual', 'checks', 'flows', 'perf']
  a.suites = a.suite === 'all' ? all : a.suite.split(',').filter((s) => all.includes(s))
  if (!a.suites.length) throw new Error('bad --suite ' + a.suite)
  return a
}

const args = parseArgs(process.argv.slice(2))
const started = Date.now()
const deadline = started + args.maxMinutes * 60_000
ensureDir(OUT_DIR)
// only wipe the outputs of suites that are about to be regenerated
if (args.suites.includes('visual')) fs.rmSync(SHOTS_DIR, { recursive: true, force: true })
if (args.suites.includes('flows')) fs.rmSync(path.join(OUT_DIR, 'flows'), { recursive: true, force: true })
ensureDir(SHOTS_DIR)
openLog(path.join(OUT_DIR, 'run.log'))

const findings = []
const verified = []
const results = { startedAt: new Date(started).toISOString(), suites: args.suites, quick: args.quick, findings, verified, cases: [], flows: [], perf: null, special: null, aborted: null }
let server = null
let browser = null
let cleaned = false
let unhandled = 0

async function cleanup() {
  if (cleaned) return
  cleaned = true
  if (browser) await withTimeout(browser.close(), 15_000, 'browser.close').catch((e) => log('browser close failed: ' + e.message))
  browser = null
  if (server) await stopServer(server).catch(() => {})
  server = null
}
process.on('unhandledRejection', (e) => {
  unhandled++
  findings.push({ check: 'harness', severity: 'error', route: null, case: 'harness', selector: null, detail: 'unhandled rejection: ' + String(e?.message || e).slice(0, 300) })
  log('unhandled rejection: ' + String(e?.message || e).slice(0, 200))
})
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => {
  log(`received ${sig}, cleaning up`)
  await cleanup()
  process.exit(130)
})
// hard cap: graceful stop at the deadline (checked between cases), forced exit 90 s later
const watchdog = setTimeout(async () => {
  log('HARD CAP exceeded — forcing cleanup')
  results.aborted = 'hard cap forced exit'
  try {
    results.durationMs = Date.now() - started
    writeReports(results)
  } catch {}
  await cleanup()
  process.exit(3)
}, deadline - started + 90_000)
const overDeadline = () => {
  if (Date.now() > deadline) {
    results.aborted ??= `time cap ${args.maxMinutes} min reached`
    return true
  }
  return false
}

async function main() {
  // ---- target ----
  if (args.base) {
    results.target = { kind: /:4310\b/.test(args.base) ? 'dev server' : 'given base', url: args.base }
  } else {
    let built = { ok: !args.build }
    if (args.build) built = await build({ retries: args.buildRetries, retryWaitMs: args.buildWait * 1000 })
    if (built.ok && fs.existsSync(path.join(ROOT, 'dist/index.html'))) {
      server = await startPreview(args.port)
      results.target = { kind: 'production build (vite preview)', url: server.url, buildMs: built.ms }
    } else {
      const dev = 'http://localhost:4310/'
      const reachable = await fetch(dev).then((r) => r.ok).catch(() => false)
      if (!reachable) throw new Error('build failed and dev server on 4310 is not reachable')
      results.target = { kind: 'dev server (fallback)', url: dev, note: 'production build failed: ' + String(built.error || '').split('\n')[0].slice(0, 200) }
      log('FALLBACK: testing against dev server ' + dev)
    }
  }
  const base = results.target.url
  log(`target: ${results.target.kind} ${base}`)

  const { cases } = await buildMatrix({ quick: args.quick, only: args.only, v13: args.v13 })
  const full = await buildMatrix({ quick: false })
  results.plannedCases = cases.length
  results.fullMatrixCases = full.cases.length
  log(`planned cases: ${cases.length}${args.quick ? ` (quick subset; full matrix = ${full.cases.length})` : ''}`)

  ;({ browser } = await launchBrowser().then((r) => {
    results.browser = `${r.channel} ${r.browser.version()}`
    return r
  }))

  // ---- visual + checks ----
  const doVisual = args.suites.includes('visual')
  const doChecks = args.suites.includes('checks')
  if (doVisual || doChecks) {
    const queue = [...cases]
    let done = 0
    const worker = async () => {
      while (queue.length && !overDeadline()) {
        const c = queue.shift()
        const r = await runCase(browser, base, c, { visual: doVisual, checks: doChecks, findings })
        results.cases.push(r)
        done++
        const errs = findings.filter((f) => f.case === c.id && f.severity === 'error').length
        log(`[${done}/${cases.length}] ${c.id} ${r.status} ${r.ms}ms${errs ? ` · ${errs} error finding(s)` : ''}`)
      }
    }
    await Promise.all(Array.from({ length: args.concurrency }, worker))
    const ms = results.cases.map((c) => c.ms)
    results.avgCaseMs = ms.length ? Math.round(ms.reduce((a, b) => a + b, 0) / ms.length) : null
    if (doVisual) verified.push(`screenshots: ${results.cases.length} cases (viewport JPEG; full-page ≤6000px for core pages)`)
    if (doChecks) {
      verified.push('per page: console errors / pageerror / failed requests, horizontal overflow + offending elements, occlusion of ≤60 interactive elements, undeclared truncation, contrast (≤400 text nodes), a11y basics (names, labels, dup ids, main, html[lang])')
      verified.push('phone viewports: tap targets with ±22px elementFromPoint probes; 1440 & 390: 20-stop Tab focus visibility walk')
      if (!overDeadline()) results.special = { themeFlash: await themeFlash(browser, base, findings, verified), reducedMotion: await reducedMotion(browser, base, findings, verified) }
    }
  }

  // ---- flows ----
  let rapid = null
  if (args.suites.includes('flows')) {
    let flows = FLOWS.filter((f) => !args.quick || f.quick)
    if (args.flows) flows = FLOWS.filter((f) => args.flows.some((n) => f.name.includes(n)))
    for (const f of flows) {
      if (overDeadline()) break
      const r = await runFlow(browser, base, f, { findings, quick: args.quick })
      results.flows.push(r)
      if (r.metrics && f.name === 'rapid-nav') rapid = r.metrics
    }
    verified.push(`flows executed: ${results.flows.map((f) => `${f.name} (${f.status})`).join(', ')}`)
  }

  // ---- perf ----
  if (args.suites.includes('perf') && !overDeadline()) {
    if (!rapid) {
      const rf = FLOWS.find((f) => f.name === 'rapid-nav')
      const r = await runFlow(browser, base, rf, { findings: [], quick: true })
      rapid = r.metrics || null
    }
    results.perf = await runPerf(browser, base, { findings, rapidNavMetrics: rapid, verified, dataset: 'full', variant: args.variant })
    if (!overDeadline()) results.perfDemo = await runPerf(browser, base, { findings, rapidNavMetrics: null, verified, dataset: 'demo' })
    if (!/production/.test(results.target.kind)) results.perf.notes.push(`measured against ${results.target.kind}, not the production build — budgets not meaningful`)
  }
}

let exitCode = 0
try {
  await main()
} catch (e) {
  exitCode = 1
  results.aborted = 'harness error: ' + String(e?.message || e).slice(0, 300)
  log('HARNESS ERROR: ' + (e?.stack || e).toString().slice(0, 800))
} finally {
  await cleanup()
  clearTimeout(watchdog)
  results.durationMs = Date.now() - started
  results.unhandledRejections = unhandled
  results.portFreeAfter = await portFree(args.port)
  const size = dirSize(OUT_DIR)
  results.output = { files: size.files, bytes: size.total }
  writeReports(results)
  const t = totals(findings)
  log('findings by check: ' + Object.entries(t).map(([k, v]) => `${k} e${v.error || 0}/w${v.warn || 0}/i${v.info || 0}`).join(', '))
  log(`flows: ${results.flows.map((f) => `${f.name}=${f.status}`).join(' ') || '—'}`)
  log(`done in ${Math.round(results.durationMs / 1000)}s · output ${size.files} files, ${mb(size.total)} · port ${args.port} free: ${results.portFreeAfter} · unhandled rejections: ${unhandled}`)
  log(`reports: ${path.join(OUT_DIR, 'summary.md')}`)
  closeLog()
}
process.exit(exitCode)
