// Production build + `vite preview` on a dedicated port. The preview server is always
// stopped by the caller (stopServer in finally). Never touches the dev server on 4310.
import { spawn, spawnSync } from 'node:child_process'
import net from 'node:net'
import path from 'node:path'
import { ROOT, log, debug, sleep, clip } from './util.mjs'

const VITE = path.join(ROOT, 'node_modules/vite/bin/vite.js')

export function portFree(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const s = net.createServer()
    s.once('error', () => resolve(false))
    s.once('listening', () => s.close(() => resolve(true)))
    s.listen(port, host)
  })
}

export async function build({ retries = 3, retryWaitMs = 60_000 } = {}) {
  for (let i = 1; i <= retries; i++) {
    const t0 = Date.now()
    const r = spawnSync(process.execPath, [VITE, 'build', '--logLevel', 'warn'], { cwd: ROOT, encoding: 'utf8', timeout: 240_000, maxBuffer: 8 * 1024 * 1024 })
    const ms = Date.now() - t0
    if (r.status === 0) {
      log(`build ok in ${ms}ms (attempt ${i})`)
      return { ok: true, ms, attempts: i }
    }
    const err = clip(((r.stderr || '') + (r.stdout || '') + (r.error ? String(r.error) : '')).trim(), 1500)
    log(`build FAILED (attempt ${i}/${retries}): ${err.split('\n').slice(0, 6).join(' | ')}`)
    debug('build output', err)
    if (i < retries) {
      log(`waiting ${Math.round(retryWaitMs / 1000)}s before retrying build`)
      await sleep(retryWaitMs)
    } else return { ok: false, ms, attempts: i, error: err }
  }
}

export async function startPreview(port = 4311) {
  if (!(await portFree(port))) throw new Error(`port ${port} is busy — refusing to reuse an unknown server`)
  const child = spawn(process.execPath, [VITE, 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  let out = ''
  const onData = (d) => {
    if (out.length < 8000) out += d.toString()
  }
  child.stdout.on('data', onData)
  child.stderr.on('data', onData)
  const url = `http://127.0.0.1:${port}/`
  const t0 = Date.now()
  while (Date.now() - t0 < 30_000) {
    if (child.exitCode != null) throw new Error('vite preview exited early: ' + clip(out, 600))
    try {
      const r = await fetch(url)
      if (r.ok) {
        log(`preview server up at ${url} (pid ${child.pid})`)
        return { child, url, pid: child.pid }
      }
    } catch {}
    await sleep(300)
  }
  stopServer({ child })
  throw new Error('vite preview did not come up in 30s: ' + clip(out, 600))
}

export async function stopServer(srv) {
  if (!srv?.child) return
  const { child } = srv
  if (child.exitCode != null) return
  try {
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
    else child.kill('SIGTERM')
  } catch {}
  const t0 = Date.now()
  while (child.exitCode == null && child.signalCode == null && Date.now() - t0 < 5000) await sleep(100)
  log(`preview server stopped (pid ${child.pid})`)
}
