// Shared helpers: paths, bounded logging, timing, small async utilities.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const QA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const ROOT = path.resolve(QA_DIR, '..')
export const OUT_DIR = path.join(QA_DIR, 'out')
export const SHOTS_DIR = path.join(OUT_DIR, 'shots')
export const FLOW_SHOTS_DIR = path.join(OUT_DIR, 'flows')

export function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true })
  return d
}

// ---- bounded logger -------------------------------------------------------
// Console gets one short line per event; the log file is capped (default 2 MB).
const LOG_CAP = 2 * 1024 * 1024
let logFd = null
let logBytes = 0
let logTruncated = false

export function openLog(file) {
  ensureDir(path.dirname(file))
  logFd = fs.openSync(file, 'w')
  logBytes = 0
  logTruncated = false
}
export function closeLog() {
  if (logFd != null) {
    try {
      fs.closeSync(logFd)
    } catch {}
    logFd = null
  }
}
function clip(s, n = 400) {
  s = String(s)
  return s.length > n ? s.slice(0, n) + `…(+${s.length - n})` : s
}
function writeLog(line) {
  if (logFd == null) return
  if (logBytes > LOG_CAP) {
    if (!logTruncated) {
      fs.writeSync(logFd, '[log truncated: cap reached]\n')
      logTruncated = true
    }
    return
  }
  const b = Buffer.byteLength(line)
  logBytes += b
  fs.writeSync(logFd, line)
}
export function log(...args) {
  const line = clip(args.map((a) => (typeof a === 'string' ? a : safeJson(a))).join(' '), 600)
  const stamp = new Date().toISOString().slice(11, 19)
  console.log(`[${stamp}] ${line}`)
  writeLog(`[${stamp}] ${line}\n`)
}
export function debug(...args) {
  const line = clip(args.map((a) => (typeof a === 'string' ? a : safeJson(a))).join(' '), 1200)
  writeLog(`[debug] ${line}\n`)
}
export function safeJson(v) {
  try {
    return JSON.stringify(v, (k, val) => (val && typeof val === 'object' && (val.type === 'Buffer' || ArrayBuffer.isView(val)) ? '[binary]' : val))
  } catch {
    return String(v)
  }
}
export { clip }

// ---- misc -----------------------------------------------------------------
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export function withTimeout(promise, ms, label) {
  let t
  return Promise.race([
    promise,
    new Promise((_, rej) => {
      t = setTimeout(() => rej(new Error(`timeout after ${ms}ms: ${label}`)), ms)
    }),
  ]).finally(() => clearTimeout(t))
}

export function slugRoute(route) {
  if (route === '/' || route === '') return 'home'
  return (
    route
      .replace(/^\//, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'home'
  )
}

export function median(a) {
  if (!a.length) return null
  const s = [...a].sort((x, y) => x - y)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
export function pct(a, p) {
  if (!a.length) return null
  const s = [...a].sort((x, y) => x - y)
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]
}
export const round = (n, d = 1) => (n == null ? null : Math.round(n * 10 ** d) / 10 ** d)

export function dirSize(d) {
  let total = 0
  let files = 0
  if (!fs.existsSync(d)) return { total, files }
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) {
      const s = dirSize(p)
      total += s.total
      files += s.files
    } else {
      total += fs.statSync(p).size
      files++
    }
  }
  return { total, files }
}
export const mb = (b) => (b / 1024 / 1024).toFixed(2) + ' MB'
