import { reactive } from 'vue'

/**
 * 全站唯一的同步状态机（裁决 S1）。
 *
 *   idle → running(phase 0 读取鼓众广场 → 1 写入 Viewer → 2 推送到同步目标) → success | partial | failed
 *
 * 原型用 Mock 计时模拟；下一次的结果由 `configureSync({ getOutcome })` 提供（原型控制面板的「下一次同步结果」）。
 * 计时器在模块级，路由切换不打断同步；`reset()` 之后旧计时器即使触发也不会再写状态（代号校验）。
 *
 * 导出：
 *   sync                     响应式状态 { state, phase, result, lastSyncLabel, fresh, panelOpen }
 *   startSync({ retryTargets }) 开始同步；retryTargets=true 只重推失败的目标（部分成功后的「重试失败的目标」）
 *   reset()                  回到 idle，丢弃进行中的计时器
 *   openSyncPanel() / closeSyncPanel()
 *   configureSync({ getOutcome, onDone, onStart })
 *   sampleResult(outcome)    生成一份示例结果（success | partial | failed），不改状态；给 SyncPanel 的 force 规格样张用
 */

export const PHASE_MS = 800
export const FRESH_MS = 2500

export const SYNC_PHASES = [
  { key: 'read', zh: '读取鼓众广场', ja: '鼓衆広場から取得' },
  { key: 'write', zh: '写入 Viewer', ja: 'Viewer に反映' },
  { key: 'push', zh: '推送到同步目标', ja: '連携先へ送信' },
]

export const SYNC_TARGETS = [
  { key: 'viewer', zh: 'Viewer 成长记录', ja: 'Viewer 成長記録' },
  { key: 'ourtaiko', zh: 'OurTaiko', ja: 'OurTaiko' },
  { key: 'kinoko', zh: '菌菌控制台', ja: 'Kinoko コンソール' },
]

const FAIL_TARGET = {
  key: 'kinoko',
  reasonZh: 'API key 已过期，更新后再重试',
  reasonJa: 'API キーの期限切れです。更新してから再試行してください',
}

export const sync = reactive({
  state: 'idle', // idle | running | success | partial | failed
  phase: 0, // running 时 0..2
  retrying: false, // 本次是否只重推失败的目标
  result: null, // 最近一次完成的结果，见 makeResult()
  lastSyncLabel: { zh: '2 小时前', ja: '2 時間前' }, // 上次「成绩写入成功」的时间
  fresh: false, // 刚刚成功：按钮显示对勾约 2.5 秒
  panelOpen: false,
})

let hooks = { getOutcome: () => 'success', onDone: null, onStart: null }
export function configureSync(h) {
  hooks = { ...hooks, ...h }
}

let gen = 0
let timers = []
function later(fn, ms) {
  const my = gen
  timers.push(
    setTimeout(() => {
      if (my === gen) fn()
    }, ms),
  )
}
function clearTimers() {
  timers.forEach(clearTimeout)
  timers = []
}

function makeResult(outcome, prev) {
  const at = Date.now()
  if (outcome === 'failed') {
    return {
      outcome,
      at,
      records: 0,
      pb: 0,
      rank: 0,
      dfc: 0,
      fc: 0,
      reasonZh: '鼓众广场暂时没有响应',
      reasonJa: '鼓衆広場から応答がありません',
      targets: SYNC_TARGETS.map((t) => ({ ...t, ok: null })),
    }
  }
  const base = prev && prev.outcome !== 'failed' ? prev : { records: 4, pb: 2, rank: 1, dfc: 1, fc: 0 }
  return {
    outcome,
    at,
    records: base.records,
    pb: base.pb,
    rank: base.rank,
    dfc: base.dfc,
    fc: base.fc,
    targets: SYNC_TARGETS.map((t) =>
      outcome === 'partial' && t.key === FAIL_TARGET.key ? { ...t, ok: false, reasonZh: FAIL_TARGET.reasonZh, reasonJa: FAIL_TARGET.reasonJa } : { ...t, ok: true },
    ),
  }
}

/** 示例结果：与真实同步完成时的结构相同，不写任何状态（I7）。 */
export function sampleResult(outcome = 'success') {
  return makeResult(normalizeOutcome(outcome))
}

export function failedTargets(result = sync.result) {
  return result?.targets?.filter((t) => t.ok === false) ?? []
}

function finish(outcome, prev) {
  sync.result = makeResult(outcome, prev)
  sync.state = outcome
  sync.retrying = false
  if (outcome !== 'failed') {
    sync.lastSyncLabel = { zh: '刚刚', ja: 'たった今' }
  }
  if (outcome === 'success') {
    sync.fresh = true
    later(() => (sync.fresh = false), FRESH_MS)
  }
  hooks.onDone?.(outcome, sync.result)
}

/**
 * 开始一次同步。正在同步时忽略。
 * - retryTargets：部分成功后「重试失败的目标」，只跑推送阶段，结果为成功。
 * - 从失败状态重试（任何入口）：结果为成功。
 */
export function startSync({ retryTargets = false } = {}) {
  if (sync.state === 'running') return false
  const from = sync.state
  const prev = sync.result
  clearTimers()
  gen++
  sync.fresh = false
  sync.state = 'running'
  hooks.onStart?.()
  if (retryTargets && from === 'partial') {
    sync.retrying = true
    sync.phase = 2
    later(() => finish('success', prev), PHASE_MS)
    return true
  }
  const retry = from === 'failed' || from === 'partial'
  const outcome = retry ? 'success' : normalizeOutcome(hooks.getOutcome?.())
  sync.retrying = false
  sync.phase = 0
  if (outcome === 'failed') {
    later(() => finish('failed'), PHASE_MS * 1.5)
    return true
  }
  later(() => (sync.phase = 1), PHASE_MS)
  later(() => (sync.phase = 2), PHASE_MS * 2)
  later(() => finish(outcome), PHASE_MS * 3)
  return true
}

function normalizeOutcome(v) {
  return v === 'partial' || v === 'failed' ? v : 'success'
}

/** 回到空闲。之前排队的计时器全部作废，不会再写状态。 */
export function reset() {
  clearTimers()
  gen++
  sync.state = 'idle'
  sync.phase = 0
  sync.retrying = false
  sync.fresh = false
}

export function openSyncPanel() {
  sync.panelOpen = true
}
export function closeSyncPanel() {
  sync.panelOpen = false
  // 成功结果看过之后回到空闲（结果保留为「上次同步」摘要）；部分成功 / 失败保留，直到重试
  if (sync.state === 'success') sync.state = 'idle'
}
