// node src/sync.test.mjs —— 同步状态机（S1）测试，用假计时器。
let now = 0
let queue = []
let nextId = 1
globalThis.setTimeout = (fn, ms = 0) => {
  const id = nextId++
  queue.push({ id, at: now + ms, fn })
  return id
}
globalThis.clearTimeout = (id) => (queue = queue.filter((t) => t.id !== id))
function advance(ms) {
  const end = now + ms
  for (;;) {
    queue.sort((a, b) => a.at - b.at)
    const t = queue[0]
    if (!t || t.at > end) break
    queue.shift()
    now = t.at
    t.fn()
  }
  now = end
}

const { sync, startSync, reset, configureSync, failedTargets, closeSyncPanel, openSyncPanel, PHASE_MS } = await import('./sync.js')

let pass = 0
let fail = 0
const ok = (c, name, extra = '') => {
  c ? pass++ : fail++
  console.log(`${c ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`)
}

let outcome = 'success'
const done = []
configureSync({ getOutcome: () => outcome, onDone: (o) => done.push(o) })

// success
ok(sync.state === 'idle', '初始 idle')
startSync()
ok(sync.state === 'running' && sync.phase === 0, '开始 → running 阶段 0')
ok(startSync() === false, '同步中再次开始被忽略')
advance(PHASE_MS)
ok(sync.phase === 1, '800ms → 阶段 1')
advance(PHASE_MS)
ok(sync.phase === 2, '1600ms → 阶段 2')
advance(PHASE_MS)
ok(sync.state === 'success' && sync.fresh, '2400ms → success，显示对勾')
ok(sync.result.records === 4 && sync.result.pb === 2 && sync.result.rank === 1 && sync.result.dfc === 1, '结果：4 条新进展（刷新 2、评价升级 1、新全良 1）')
ok(sync.lastSyncLabel.zh === '刚刚', '上次同步 = 刚刚')
advance(2500)
ok(!sync.fresh && sync.state === 'success', '2.5 秒后对勾消失')
openSyncPanel()
closeSyncPanel()
ok(sync.state === 'idle', '看过成功结果后关闭面板 → idle')

// partial → retry targets
outcome = 'partial'
startSync()
advance(PHASE_MS * 3)
ok(sync.state === 'partial' && failedTargets().length === 1 && /API key/.test(failedTargets()[0].reasonZh), 'partial：1 个目标失败并带原因')
startSync({ retryTargets: true })
ok(sync.state === 'running' && sync.phase === 2 && sync.retrying, '重试失败的目标 → 只跑推送阶段')
advance(PHASE_MS)
ok(sync.state === 'success' && failedTargets().length === 0, '重试后成功')

// failed → retry
outcome = 'failed'
reset()
startSync()
advance(PHASE_MS * 3)
ok(sync.state === 'failed' && /没有响应/.test(sync.result.reasonZh), 'failed：鼓众广场暂时没有响应')
ok(sync.lastSyncLabel.zh === '刚刚', '失败不改上次同步时间（仍是上一次成功的「刚刚」）')
startSync()
advance(PHASE_MS * 3)
ok(sync.state === 'success', '失败后重试 → 成功')

// reset 作废进行中的计时器
outcome = 'success'
startSync()
advance(PHASE_MS)
reset()
const before = JSON.stringify(sync)
advance(PHASE_MS * 10)
ok(sync.state === 'idle' && JSON.stringify(sync) === before, 'reset() 之后旧计时器不再写状态')
ok(queue.length === 0, 'reset() 清掉全部计时器')
ok(done.join(',') === 'success,partial,success,failed,success', 'onDone 回调顺序', done.join(','))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
