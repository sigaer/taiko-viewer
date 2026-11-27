<script setup>
import { computed, reactive, ref, watch } from 'vue'
import Icon from '../components/Icon.vue'
import Sheet from '../components/Sheet.vue'
import EmptyLane from '../components/EmptyLane.vue'
import SyncPanel from '../components/SyncPanel.vue'
import { player } from '../mock/data'
import { store, L, toast, reducedMotion } from '../store'
import { sync, startSync, SYNC_PHASES, SYNC_TARGETS } from '../sync'

const current = computed(() => player.bindings.find((b) => b.current) || player.bindings[0])
const NOW = '11-16 20:46'
const LAST = '11-16 18:42'

/* ---------- 主按钮与结果：全站唯一的同步状态机（S1 / S5） ---------- */
const running = computed(() => sync.state === 'running')
const isEmpty = computed(() => store.auth === 'empty')
function syncNow() {
  startSync({ retryTargets: sync.state === 'partial' })
}
const primaryLabel = computed(() => {
  if (running.value) return L(`正在同步… ${sync.phase + 1}/3`, `同期中… ${sync.phase + 1}/3`)
  if (sync.state === 'partial') return L('重试失败的目标', '失敗した連携先を再試行')
  if (sync.state === 'failed') return L('重试', '再試行')
  if (isEmpty.value) return L('开始第一次同步', '最初の同期を開始')
  return L('立即同步', '今すぐ同期')
})
const lastLabel = computed(() => (isEmpty.value && !sync.result ? L('还没有同步过', 'まだ同期していません') : L(sync.lastSyncLabel.zh, sync.lastSyncLabel.ja)))
const progressText = computed(() => (running.value ? L(`正在同步，第 ${sync.phase + 1} 步，共 3 步：${SYNC_PHASES[sync.phase].zh}`, `同期中（${sync.phase + 1}/3）：${SYNC_PHASES[sync.phase].ja}`) : ''))

/* ---------- 同步过程：步骤器（同步中高亮当前阶段） ---------- */
const STEP_TEXT = [
  { note: '', dzh: '读取游玩记录', dja: 'プレイ記録を取得' },
  { note: 'ka', dzh: '比对出新纪录', dja: '新しい記録を照合' },
  { note: 'roll', dzh: '推送到已开启的目标', dja: 'オンの連携先へ送信' },
]
const steps = computed(() =>
  SYNC_PHASES.map((p, i) => {
    let state = 'idle'
    if (running.value) state = i < sync.phase ? 'done' : i === sync.phase ? 'now' : 'todo'
    return { ...p, ...STEP_TEXT[i], n: i + 1, state }
  }),
)

/* ---------- 同步目标：状态来自最近一次同步结果 ---------- */
const enabled = reactive({ viewer: true, ourtaiko: true, kinoko: true, sakura: false })
const TARGETS = [...SYNC_TARGETS.map((t) => ({ ...t, locked: t.key === 'viewer' })), { key: 'sakura', zh: 'Sakura Bot', ja: 'Sakura Bot', locked: false }]
const resultOf = (key) => sync.result?.targets?.find((t) => t.key === key) || null
function targetState(t) {
  if (!enabled[t.key]) return { kind: 'off' }
  if (running.value) return { kind: sync.phase === 2 ? 'pushing' : 'waiting' }
  if (isEmpty.value && !sync.result) return { kind: 'first' }
  if (!sync.result) return t.key === 'sakura' ? { kind: 'next' } : { kind: 'ok', at: LAST }
  const r = resultOf(t.key)
  if (!r) return { kind: 'next' }
  if (r.ok === false) return { kind: 'fail', reason: L(r.reasonZh, r.reasonJa) }
  if (r.ok === null) return { kind: 'skipped' }
  return { kind: 'ok', at: NOW }
}
const targetRows = computed(() => TARGETS.map((t) => ({ ...t, st: targetState(t) })))
function toggle(t) {
  if (t.locked) return
  enabled[t.key] = !enabled[t.key]
}

/* ---------- 最近同步 ---------- */
const SEED = [
  { id: 7, time: LAST, outcome: 'success', records: 4, pb: 2, fc: 0, dfc: 1, dur: 6.2 },
  { id: 6, time: '11-15 22:10', outcome: 'partial', records: 7, pb: 5, fc: 1, dfc: 0, dur: 7.8, zh: '菌菌控制台：API key 已过期', ja: 'Kinoko コンソール：API キーの期限切れ' },
  { id: 5, time: '11-13 21:37', outcome: 'success', records: 0, pb: 0, fc: 0, dfc: 0, dur: 3.1 },
  { id: 4, time: '11-12 20:05', outcome: 'failed', dur: 30, zh: '鼓众广场响应超时', ja: '鼓衆広場がタイムアウト' },
  { id: 3, time: '11-12 19:58', outcome: 'success', records: 11, pb: 6, fc: 1, dfc: 0, dur: 9.4 },
  { id: 2, time: '11-09 16:21', outcome: 'success', records: 3, pb: 3, fc: 0, dfc: 0, dur: 5.6 },
]
const seedHistory = () => (store.auth === 'empty' ? [] : SEED.map((r) => ({ ...r })))
const history = ref(seedHistory())
watch(
  () => store.auth,
  () => (history.value = seedHistory()),
)
// 一次同步结束：写入历史
watch(
  () => sync.state,
  (st, prev) => {
    if (prev !== 'running' || !['success', 'partial', 'failed'].includes(st) || !sync.result) return
    const r = sync.result
    const row = { id: Date.now(), time: NOW, outcome: st, dur: st === 'failed' ? 1.2 : 2.4 }
    if (st !== 'failed') Object.assign(row, { records: r.records, pb: r.pb, fc: r.fc, dfc: r.dfc })
    if (st === 'failed') Object.assign(row, { zh: r.reasonZh, ja: r.reasonJa })
    if (st === 'partial') {
      const f = r.targets.find((t) => t.ok === false)
      if (f) Object.assign(row, { zh: `${f.zh}：${f.reasonZh}`, ja: `${f.ja}：${f.reasonJa}` })
    }
    history.value = [row, ...history.value].slice(0, 8)
  },
)
const OUTCOME = {
  success: { zh: '成功', ja: '成功', cls: 'tag-ok', icon: 'check' },
  partial: { zh: '部分成功', ja: '一部成功', cls: 'tag-roll', icon: 'warn' },
  failed: { zh: '失败', ja: '失敗', cls: 'tag-danger', icon: 'warn' },
}

/* ---------- 网页成绩 token ---------- */
const tokenTail = ref('a71c')
const masked = computed(() => `tvs_••••••••••••${tokenTail.value}`)
const newTail = () => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0')
function copyToken() {
  try {
    navigator.clipboard?.writeText(masked.value)
  } catch {
    /* 剪贴板不可用时忽略 */
  }
  toast(L('token 已复制', 'トークンをコピーしました'))
}
function generate() {
  tokenTail.value = newTail()
  toast(L('已生成 token', 'トークンを発行しました'))
}
const confirmKind = ref('') // regen | revoke
function runConfirm() {
  if (confirmKind.value === 'regen') {
    tokenTail.value = newTail()
    toast(L('已生成新的 token，旧 token 已失效', '新しいトークンを発行しました。古いトークンは無効です'))
  } else if (confirmKind.value === 'revoke') {
    tokenTail.value = ''
    toast(L('token 已吊销', 'トークンを失効させました'))
  }
  confirmKind.value = ''
}

/* ---------- 菌菌控制台迁移 ---------- */
const mig = reactive({ key: '', error: '' })
function startMigrate() {
  if (mig.key.trim().length < 16) {
    mig.error = L('API key 至少 16 位。到菌菌控制台的「账号」页复制完整的 key 再粘贴。', 'API キーは 16 文字以上です。Kinoko コンソールの「アカウント」から全体をコピーして貼り付けてください。')
    document.getElementById('mig-key')?.focus()
    return
  }
  mig.key = ''
  toast(L('迁移已开始，完成后会出现在同步记录里', '移行を開始しました。完了すると同期履歴に表示されます'))
}
</script>

<template>
  <div class="page sync">
    <EmptyLane v-if="store.auth === 'guest'" :title="L('登录后管理同步', 'ログインして同期を管理')">
      <RouterLink to="/login" class="btn btn-primary">{{ L('登录', 'ログイン') }}</RouterLink>
    </EmptyLane>
    <EmptyLane v-else-if="store.auth === 'unbound'" :title="L('先绑定鼓众广场 ID', 'まず鼓衆広場 ID を連携')" :text="L('绑定之后才能把游玩记录同步过来。', '連携するとプレイ記録を同期できます。')">
      <RouterLink to="/bind" class="btn btn-primary">{{ L('去绑定', '連携する') }}</RouterLink>
    </EmptyLane>

    <div v-else class="vcol">
      <!-- 1 当前账号 + 同步结果 -->
      <section class="panel top" aria-labelledby="sync-acct-h">
        <div class="top-main">
          <span class="tag region">{{ current.region }}</span>
          <div class="grow">
            <h2 id="sync-acct-h" class="acct-name">
              <span class="title-1l" :title="current.name">{{ current.name }}</span>
              <span class="num id">{{ current.taikoId }}</span>
            </h2>
            <p class="last">
              <span>{{ L('上次同步', '前回の同期') }} <b>{{ lastLabel }}</b></span>
              <RouterLink to="/account" class="link">{{ L('切换账号', 'アカウントを切り替え') }}</RouterLink>
            </p>
          </div>
          <button type="button" class="btn btn-primary btn-lg go" :disabled="running" @click="syncNow">
            <Icon name="sync" :size="18" :class="{ spin: running && !reducedMotion }" />
            {{ primaryLabel }}
          </button>
        </div>
        <p class="sr-only" aria-live="polite">{{ progressText }}</p>
        <p v-if="isEmpty && !sync.result && !running" class="first-hint">{{ L('第一次同步大约需要 10 秒。', '最初の同期は 10 秒ほどかかります。') }}</p>
        <SyncPanel result-only class="last-result" />
      </section>

      <!-- 2 同步过程 -->
      <section aria-labelledby="sync-flow-h">
        <div class="section-head"><h2 id="sync-flow-h" class="t-h2">{{ L('同步过程', '同期の流れ') }}</h2></div>
        <ol class="stepper" :class="{ live: running }">
          <li v-for="s in steps" :key="s.key" :class="s.state" :aria-current="s.state === 'now' ? 'step' : undefined">
            <i class="note big" :class="s.state === 'done' ? 'ka' : s.state === 'todo' ? 'ghost' : s.state === 'now' ? '' : s.note">
              <Icon v-if="s.state === 'done'" name="check" :size="14" />
              <span v-else class="num">{{ s.n }}</span>
            </i>
            <b>{{ L(s.zh, s.ja) }}</b>
            <span class="step-d">{{ L(s.dzh, s.dja) }}</span>
          </li>
        </ol>
      </section>

      <!-- 3 同步目标 -->
      <section aria-labelledby="sync-tg-h">
        <div class="section-head"><h2 id="sync-tg-h" class="t-h2">{{ L('同步目标', '連携先') }}</h2></div>
        <ul class="panel rows">
          <li v-for="t in targetRows" :key="t.key" class="tg">
            <div class="grow">
              <p class="tg-name">
                <b>{{ L(t.zh, t.ja) }}</b>
                <span v-if="t.locked" class="t-small">{{ L('始终开启', '常にオン') }}</span>
              </p>
              <p class="tg-res">
                <template v-if="t.st.kind === 'off'"><span class="tag"><i class="ring" aria-hidden="true" />{{ L('未开启', 'オフ') }}</span></template>
                <template v-else-if="t.st.kind === 'ok'">
                  <span class="tag tag-ok"><Icon name="check" :size="12" />{{ L('已同步', '同期済み') }}</span>
                  <span class="num">{{ t.st.at }}</span>
                </template>
                <template v-else-if="t.st.kind === 'fail'">
                  <span class="tag tag-danger"><Icon name="warn" :size="12" />{{ L('失败', '失敗') }}</span>
                  <span class="reason">{{ t.st.reason }}</span>
                </template>
                <template v-else-if="t.st.kind === 'pushing'"><span class="tag tag-info"><Icon name="sync" :size="12" />{{ L('正在推送', '送信中') }}</span></template>
                <template v-else-if="t.st.kind === 'waiting'"><span class="tag"><Icon name="clock" :size="12" />{{ L('等待推送', '送信待ち') }}</span></template>
                <template v-else-if="t.st.kind === 'skipped'"><span class="tag"><i class="ring" aria-hidden="true" />{{ L('这次没有推送', '今回は未送信') }}</span></template>
                <template v-else-if="t.st.kind === 'first'"><span class="tag"><Icon name="clock" :size="12" />{{ L('第一次同步后推送', '最初の同期後に送信') }}</span></template>
                <template v-else><span class="tag"><Icon name="clock" :size="12" />{{ L('下次同步时推送', '次回の同期から送信') }}</span></template>
              </p>
            </div>
            <button v-if="t.st.kind === 'fail'" type="button" class="btn btn-sm" :disabled="running" @click="startSync({ retryTargets: true })">{{ L('重试', '再試行') }}</button>
            <button type="button" class="sw" role="switch" :aria-checked="enabled[t.key]" :aria-label="L(`推送到 ${t.zh}`, `${t.ja} へ送信`)" :disabled="t.locked" @click="toggle(t)"><i /></button>
          </li>
        </ul>
      </section>

      <!-- 4 最近同步 -->
      <section aria-labelledby="sync-hist-h">
        <div class="section-head"><h2 id="sync-hist-h" class="t-h2">{{ L('最近同步', '最近の同期') }}</h2></div>
        <div class="panel">
          <EmptyLane v-if="!history.length" compact :title="L('还没有同步记录', '同期履歴はまだありません')" />
          <template v-else>
            <div class="only-desktop scroll-x">
              <table class="dt">
                <caption class="sr-only">{{ L('最近的同步记录', '最近の同期履歴') }}</caption>
                <thead>
                  <tr>
                    <th scope="col">{{ L('时间', '日時') }}</th>
                    <th scope="col">{{ L('状态', '状態') }}</th>
                    <th scope="col" class="r">{{ L('新进展', '新しい記録') }}</th>
                    <th scope="col" class="r">{{ L('刷新成绩', '自己ベスト') }}</th>
                    <th scope="col" class="r">{{ L('全连', 'フルコンボ') }}</th>
                    <th scope="col" class="r">{{ L('全良', '全良') }}</th>
                    <th scope="col" class="r">{{ L('用时', '所要時間') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="h in history" :key="h.id">
                    <th scope="row" class="num when">{{ h.time }}</th>
                    <td class="state-cell">
                      <span class="tag" :class="OUTCOME[h.outcome].cls"><Icon :name="OUTCOME[h.outcome].icon" :size="12" />{{ L(OUTCOME[h.outcome].zh, OUTCOME[h.outcome].ja) }}</span>
                      <span v-if="h.zh" class="why">{{ L(h.zh, h.ja) }}</span>
                    </td>
                    <template v-if="h.outcome === 'failed'">
                      <td v-for="k in 4" :key="k" class="r"><span class="na">—</span></td>
                    </template>
                    <template v-else>
                      <td class="r num big" :class="{ faint: !h.records }">{{ h.records }}</td>
                      <td class="r num" :class="{ faint: !h.pb }">{{ h.pb }}</td>
                      <td class="r num" :class="{ faint: !h.fc }">{{ h.fc }}</td>
                      <td class="r num" :class="{ faint: !h.dfc }">{{ h.dfc }}</td>
                    </template>
                    <td class="r nowrap"><span class="num">{{ h.dur.toFixed(1) }}</span> {{ L('秒', '秒') }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <ul class="only-mobile rows">
              <li v-for="h in history" :key="h.id" class="hrow">
                <div class="spread">
                  <span class="num">{{ h.time }}</span>
                  <span class="tag" :class="OUTCOME[h.outcome].cls"><Icon :name="OUTCOME[h.outcome].icon" :size="12" />{{ L(OUTCOME[h.outcome].zh, OUTCOME[h.outcome].ja) }}</span>
                </div>
                <p v-if="h.outcome !== 'failed'" class="hstats">
                  <span>{{ L('新进展', '新しい記録') }}<b class="num">{{ h.records }}</b></span>
                  <span>{{ L('刷新成绩', '自己ベスト') }}<b class="num">{{ h.pb }}</b></span>
                  <span>{{ L('全连', 'フルコンボ') }}<b class="num">{{ h.fc }}</b></span>
                  <span>{{ L('全良', '全良') }}<b class="num">{{ h.dfc }}</b></span>
                </p>
                <p v-if="h.zh" class="why">{{ L(h.zh, h.ja) }}</p>
              </li>
            </ul>
          </template>
        </div>
      </section>

      <!-- 5 网页成绩 token -->
      <section aria-labelledby="sync-token-h">
        <div class="section-head">
          <h2 id="sync-token-h" class="t-h2">{{ L('网页成绩 token', 'Web スコアトークン') }}</h2>
          <RouterLink to="/account/developer" class="more">{{ L('token 使用说明', 'トークンの使い方') }}</RouterLink>
        </div>
        <div class="panel panel-pad col token-box">
          <template v-if="tokenTail">
            <code class="num token">{{ masked }}</code>
            <div class="row-wrap">
              <button type="button" class="btn btn-sm" @click="copyToken"><Icon name="copy" :size="14" />{{ L('复制', 'コピー') }}</button>
            </div>
          </template>
          <template v-else>
            <p class="t-small">{{ L('没有可用的 token。', '有効なトークンはありません。') }}</p>
            <div><button type="button" class="btn" @click="generate"><Icon name="key" :size="16" />{{ L('生成 token', 'トークンを発行') }}</button></div>
          </template>
        </div>
        <div v-if="tokenTail" class="danger-zone">
          <button type="button" class="btn btn-ghost quiet-danger" @click="confirmKind = 'regen'">{{ L('重新生成…', '再発行…') }}</button>
          <button type="button" class="btn btn-ghost quiet-danger" @click="confirmKind = 'revoke'">{{ L('吊销 token…', 'トークンを失効…') }}</button>
        </div>
      </section>

      <!-- 6 从菌菌控制台迁移 -->
      <section aria-labelledby="sync-mig-h">
        <div class="section-head"><h2 id="sync-mig-h" class="t-h2">{{ L('从菌菌控制台迁移', 'Kinoko コンソールから移行') }}</h2></div>
        <form class="panel panel-pad col mig" novalidate @submit.prevent="startMigrate">
          <div class="field">
            <label for="mig-key">API key</label>
            <input
              id="mig-key"
              v-model="mig.key"
              class="input num"
              :class="{ 'is-error': mig.error }"
              placeholder="kk_…"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              enterkeyhint="go"
              :aria-invalid="!!mig.error"
              :aria-describedby="mig.error ? 'mig-key-err' : 'mig-key-hint'"
              @input="mig.error = ''"
            />
            <span v-if="mig.error" id="mig-key-err" class="field-error" role="alert">{{ mig.error }}</span>
            <span v-else id="mig-key-hint" class="field-hint">{{ L('只用来读取一次历史成绩，迁移后不会保存。', '過去のスコアを一度読み込むためだけに使い、移行後は保存しません。') }}</span>
          </div>
          <div><button type="submit" class="btn btn-ink">{{ L('开始迁移', '移行を開始') }}</button></div>
        </form>
      </section>
    </div>

    <!-- token 确认 -->
    <Sheet :open="!!confirmKind" :title="confirmKind === 'revoke' ? L('吊销 token', 'トークンを失効') : L('重新生成 token', 'トークンを再発行')" :width="440" @close="confirmKind = ''">
      <p class="consequence">
        {{
          confirmKind === 'revoke'
            ? L('吊销后，用这个 token 上传网页成绩的脚本会立即失效。', '失効させると、このトークンで Web スコアを送っているスクリプトはすぐに使えなくなります。')
            : L('生成新 token 后旧 token 立即失效，需要在脚本里换成新 token。', '再発行すると古いトークンはすぐに無効になります。スクリプトの設定を更新してください。')
        }}
      </p>
      <template #foot>
        <button type="button" class="btn" @click="confirmKind = ''">{{ L('取消', 'キャンセル') }}</button>
        <button type="button" class="btn btn-danger" @click="runConfirm">{{ confirmKind === 'revoke' ? L('吊销 token', 'トークンを失効させる') : L('生成并让旧 token 失效', '再発行して古いトークンを無効化') }}</button>
      </template>
    </Sheet>
  </div>
</template>

<style scoped>
.vcol {
  display: flex;
  flex-direction: column;
  gap: var(--sp-10);
  max-width: 760px;
  margin: 0 auto;
}
.vcol > section {
  min-width: 0;
}

/* 1 当前账号 */
.top-main {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  padding: var(--sp-5) var(--sp-5);
}
.region {
  flex: none;
  justify-content: center;
  min-width: 40px;
  font-size: var(--fs-12);
  font-weight: 700;
}
.top-main .grow {
  min-width: 0;
}
.acct-name {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
  font-size: var(--fs-18);
  font-weight: 700;
}
.id {
  flex: none;
  font-size: var(--fs-14);
  font-weight: 500;
  color: var(--ink-2);
}
.last {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 16px;
  margin-top: 2px;
  font-size: var(--fs-14);
  color: var(--ink-2);
}
.last b {
  color: var(--ink);
}
.go {
  flex: none;
  min-width: 168px;
  white-space: nowrap;
}
.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.first-hint {
  padding: 0 var(--sp-5) var(--sp-4);
  font-size: var(--fs-14);
  color: var(--ink-2);
}
.last-result {
  padding: var(--sp-4) var(--sp-5) var(--sp-5);
  border-top: 1px solid var(--line);
}

/* 2 步骤器：音符沿一条线前进 */
.stepper {
  display: flex;
}
.stepper li {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 0;
  padding: 0 4px;
  text-align: center;
  font-size: var(--fs-14);
}
.stepper li + li::before {
  content: '';
  position: absolute;
  top: 15px;
  left: calc(-50% + 24px);
  right: calc(50% + 24px);
  height: 2px;
  border-radius: 1px;
  background: var(--line-strong);
}
.stepper li.done + li::before {
  background: var(--progress-line);
}
.stepper .note {
  --n: 32px;
  display: inline-grid;
  place-items: center;
  margin-bottom: 8px;
  color: var(--ink-inv);
  font-size: var(--fs-13);
  font-style: normal;
  line-height: 1;
}
.stepper .note.ghost {
  color: var(--ink-2);
}
/* D11：音符里的数字。朱色音符换 --don-solid 底（白字 ≥ 4.5:1）；浅葱 / 山吹音符上的数字用深色 */
.stepper .note:not(.ka, .roll, .ghost) {
  background: var(--action-bg);
}
.stepper .note:is(.ka, .roll) .num {
  color: var(--note-outline);
}
.stepper li.now .note {
  outline: 2px solid var(--ink);
  outline-offset: 2px;
}
.stepper li.todo {
  color: var(--ink-2);
}
.step-d {
  font-size: var(--fs-13);
  color: var(--ink-2);
}

/* 3 同步目标 */
.rows > li {
  border-bottom: 1px solid var(--line);
}
.rows > li:last-child {
  border-bottom: 0;
}
.tg {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  min-height: 72px;
  padding: var(--sp-3) var(--sp-5);
}
.tg .grow {
  min-width: 0;
}
.tg-name {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 10px;
  font-size: var(--fs-16);
}
.tg-name .t-small {
  color: var(--ink-2);
}
.tg-res {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  margin-top: 4px;
  font-size: var(--fs-14);
  color: var(--ink-2);
}
.reason {
  color: var(--ink);
}
.ring {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1.5px currentColor;
  flex: none;
}
.sw {
  position: relative;
  flex: none;
  width: 44px;
  height: 26px;
  border-radius: var(--r-note);
  background: var(--ctl-border);
  transition: background var(--dur-2);
}
.sw::after {
  content: '';
  position: absolute;
  inset: -9px 0;
}
.sw i {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--surface);
  transition: transform var(--dur-2) var(--ease-out);
}
.sw[aria-checked='true'] {
  background: var(--action-bg);
}
.sw[aria-checked='true'] i {
  transform: translateX(18px);
}
.sw[disabled] {
  cursor: default;
  background: var(--line-strong);
}
.sw:focus-visible {
  border-radius: var(--r-note);
}

/* 4 历史 */
.panel > .scroll-x {
  border-radius: inherit;
}
.dt .when {
  text-align: left;
  font-weight: 400;
  white-space: nowrap;
}
.dt .big {
  font-size: var(--fs-16);
}
.nowrap {
  white-space: nowrap;
}
.state-cell {
  min-width: 160px;
}
.why {
  display: block;
  margin-top: 4px;
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.hrow {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: var(--sp-3) var(--sp-4);
  font-size: var(--fs-14);
}
.hstats {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 16px;
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.hstats b {
  margin-left: 5px;
  font-size: var(--fs-16);
  color: var(--ink);
}

/* 5 token */
.token-box {
  gap: var(--sp-3);
}
.token {
  display: block;
  padding: 10px 12px;
  border-radius: var(--r-ctl);
  background: var(--bg-sunk);
  font-size: var(--fs-16);
  overflow-wrap: anywhere;
}
.danger-zone {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
  margin-top: var(--sp-2);
}
.quiet-danger {
  color: var(--danger);
}
.quiet-danger:hover {
  color: var(--danger);
  background: var(--danger-wash);
}
.consequence {
  font-size: var(--fs-16);
}
.mig {
  gap: var(--sp-4);
}

@media (max-width: 767px) {
  .vcol {
    gap: var(--sp-8);
  }
  .top-main {
    flex-wrap: wrap;
    padding: var(--sp-4);
  }
  .top-main .grow {
    flex-basis: calc(100% - 60px);
  }
  .go {
    width: 100%;
  }
  .first-hint {
    padding: 0 var(--sp-4) var(--sp-4);
  }
  .last-result {
    padding: var(--sp-4);
  }
  .tg {
    padding: var(--sp-3) var(--sp-4);
  }
  .danger-zone .btn {
    width: 100%;
  }
}
</style>
