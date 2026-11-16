// Route discovery. Source of truth: src/views/review/screens.js (screen list + intended auth)
// and src/router.js (all route paths). screens.js is plain data and is imported directly;
// router.js uses import.meta.glob, so its paths are parsed textually.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { ROOT } from './util.mjs'

// Concrete values for parameterised routes.
const PARAM_SAMPLES = { '/songs/:id': '/songs/615', '/community/t/:id': '/community/t/4017', '/u/:name': '/u/mochidon' }

export async function loadScreens() {
  const file = path.join(ROOT, 'src/views/review/screens.js')
  try {
    // cache-bust so a resumed run sees edits made by other agents
    const mod = await import(pathToFileURL(file).href + '?t=' + Date.now())
    const out = []
    for (const g of mod.SCREENS || []) for (const it of g.items || []) out.push({ path: it.path, name: it.name, auth: it.auth || null, group: g.group })
    return out
  } catch (e) {
    // fall back to textual parse
    const src = fs.readFileSync(file, 'utf8')
    return [...src.matchAll(/path:\s*'([^']+)'\s*,\s*name:\s*'([^']+)'(?:[^}]*?auth:\s*'(\w+)')?/g)].map((m) => ({ path: m[1], name: m[2], auth: m[3] || null, group: '?' }))
  }
}

export function loadRouterPaths() {
  const src = fs.readFileSync(path.join(ROOT, 'src/router.js'), 'utf8')
  const out = []
  for (const m of src.matchAll(/\{\s*path:\s*'([^']+)'([^\n]*)/g)) {
    const p = m[1]
    if (p.includes('(.*)')) continue // catch-all
    const concrete = PARAM_SAMPLES[p] || (p.includes(':') ? null : p)
    if (!concrete) continue
    out.push({ path: concrete, gate: /gate:\s*true/.test(m[2]), bare: /bare:\s*true/.test(m[2]) })
  }
  return out
}

export const BOGUS_ROUTE = '/zz-qa-no-such-page'
