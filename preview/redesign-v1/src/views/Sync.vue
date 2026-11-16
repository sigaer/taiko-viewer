<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import Icon from '../components/Icon.vue'
import EmptyLane from '../components/EmptyLane.vue'
import { player } from '../mock/data'
import { store, L, toast, runSync } from '../store'

const current = player.bindings.find((b) => b.current)
const NOW = '11-16 20:46'
const LAST = '11-16 18:42'

/* ---------- 同步过程 ---------- */
const STEPS = [
  { key: 'src', note: '', zh: '鼓众广场', ja: '鼓衆広場', dzh: '读取游玩记录', dja: 'プレイ記録を取得' },
  { key: 'viewer', note: 'ka', zh: 'Viewer', ja: 'Viewer', dzh: '比对出新纪录', dja: '新しい記録を照合' },
  { key: 'out', note: 'roll', zh: '你选择的服务', ja: '選択したサービス', dzh: '推送到已开启的目标', dja: 'オンの連携先へ送信' },
]
const phase = ref(-1)
const justSynced = ref(false)
let timers = []
const clearTimers = () => {
  timers.forEach(clearTimeout)
  timers = []
}
onBeforeUnmount(clearTimers)

/* ---------- 同步目标 ---------- */
const seedTargets = () => {
  const fresh = store.auth === 'empty'
  return [
    { key: 'viewer', nzh: 'Viewer 成长记录', nja: 'Viewer 成長記録', on: true, locked: true, state: fresh ? 'idle' : 'ok', at: LAST },
    { key: 'ourtaiko', nzh: 'OurTaiko', nja: 'OurTaiko', on: true, state: fresh ? 'idle' : 'ok', at: LAST },
    { key: 'kinoko', nzh: '菌菌控制台 Kinoko', nja: 'Kinoko コンソール', on: true, state: fresh ? 'idle' : 'fail', at: LAST, zh: 'API key 已过期，更新后再重试', ja: 'API キーの期限切れです。更新してから再試行してください' },
    { key: 'sakura', nzh: 'Sakura Bot', nja: 'Sakura Bot', on: false, state: 'idle', at: '' },
  ]
}
const targets = ref(seedTargets())
const tname = (t) => L(t.nzh, t.nja)
function toggle(t) {
  if (t.locked) return
  t.on = !t.on
  t.state = 'idle'
}
function retry(t) {
  t.state = 'busy'
  timers.push(
    setTimeout(() => {
      t.state = 'ok'
      t.at = NOW
      toast(L(`${t.nzh} 同步成功`, `${t.nja} への同期が完了しました`))
    }, 1400),
  )
}

/* ---------- 历史 ---------- */
const SEED = [
  { id: 6, time: LAST, records: 4, pb: 2, fc: 0, dfc: 1, dur: 6.2, ok: true },
  { id: 5, time: '11-15 22:10', records: 7, pb: 5, fc: 1, dfc: 0, dur: 7.8, ok: true },
  { id: 4, time: '11-13 21:37', records: 0, pb: 0, fc: 0, dfc: 0, dur: 3.1, ok: true },
  { id: 3, time: '11-12 20:05', records: 0, pb: 0, fc: 0, dfc: 0, dur: 30, ok: false, zh: '鼓众广场响应超时，稍后再试', ja: '鼓衆広場がタイムアウトしました。時間をおいて再試行してください' },
  { id: 2, time: '11-12 19:58', records: 11, pb: 6, fc: 1, dfc: 0, dur: 9.4, ok: true },
  { id: 1, time: '11-09 16:21', records: 3, pb: 3, fc: 0, dfc: 0, dur: 5.6, ok: true },
]
const seedHistory = () => (store.auth === 'empty' ? [] : SEED.map((r) => ({ ...r })))
const history = ref(seedHistory())
watch(
  () => store.auth,
  () => {
    history.value = seedHistory()
    targets.value = seedTargets()
    justSynced.value = false
  },
)
const lastLabel = computed(() => {
  if (justSynced.value) return L('刚刚', 'たった今')
  if (!history.value.length) return L('还没有同步过', 'まだ同期していません')
  return L(player.lastSync, player.lastSyncJa)
})

watch(
  () => store.syncing,
  (on) => {
    if (on) {
      phase.value = 0
      timers.push(
        setTimeout(() => (phase.value = 1), 700),
        setTimeout(() => (phase.value = 2), 1450),
      )
      return
    }
    phase.value = -1
    justSynced.value = true
    history.value.unshift({ id: Date.now(), time: NOW, records: 4, pb: 2, fc: 0, dfc: 1, dur: 2.2, ok: true })
    history.value = history.value.slice(0, 6)
    targets.value.forEach((t) => {
      if (t.on && t.state !== 'fail') Object.assign(t, { state: 'ok', at: NOW })
    })
  },
)

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
function regenToken() {
  tokenTail.value = newTail()
  toast(L('已生成新的 token，旧 token 立即失效', '新しいトークンを発行しました。古いトークンは無効です'))
}
function revokeToken() {
  tokenTail.value = ''
  toast(L('token 已吊销', 'トークンを失効させました'))
}

/* ---------- 菌菌控制台迁移 ---------- */
const mig = reactive({ key: '', error: '' })
function startMigrate() {
  if (mig.key.trim().length < 16) {
    mig.error = L('API key 至少 16 位。到菌菌控制台的「账号」页复制完整的 key 再粘贴。', 'API キーは 16 文字以上です。Kinoko コンソールの「アカウント」から全体をコピーして貼り付けてください。')
    return
  }
  mig.key = ''
  toast(L('迁移已开始，完成后会出现在同步记录里', '移行を開始しました。完了すると同期履歴に表示されます'))
}
</script>

<template>
  <div class="page sync">
    <EmptyLane v-if="store.auth === 'guest'" :title="L('登录后管理账号', 'ログインしてアカウントを管理')">
      <RouterLink to="/login" class="btn btn-primary">{{ L('登录', 'ログイン') }}</RouterLink>
    </EmptyLane>
    <EmptyLane v-else-if="store.auth === 'unbound'" :title="L('先绑定鼓众广场 ID', 'まず鼓衆広場 ID を連携')" :text="L('绑定之后才能把游玩记录同步过来。', '連携するとプレイ記録を同期できます。')">
      <RouterLink to="/bind" class="btn btn-primary">{{ L('去绑定', '連携する') }}</RouterLink>
    </EmptyLane>

    <template v-else>
      <!-- 当前账号 + 立即同步 -->
      <section class="panel top">
        <div class="top-main">
          <span class="stamp">{{ current.region }}</span>
          <div class="grow">
            <h1 class="t-h2">{{ current.name }}<span class="num id">{{ current.taikoId }}</span></h1>
            <p class="t-small last">
              <span>{{ L('上次同步', '前回の同期') }} <b>{{ lastLabel }}</b></span>
              <RouterLink to="/account" class="link">{{ L('切换账号', 'アカウントを切り替え') }}</RouterLink>
            </p>
          </div>
          <button class="btn btn-primary btn-lg go" :disabled="store.syncing" @click="runSync">
            <Icon name="sync" :size="18" :class="{ spin: store.syncing }" />
            {{ store.syncing ? L('同步中…', '同期中…') : L('立即同步', '今すぐ同期') }}
          </button>
        </div>
        <ol class="flow" :aria-label="L('同步过程', '同期の流れ')">
          <li v-for="(s, i) in STEPS" :key="s.key" :class="{ wait: phase >= 0 && i > phase, now: phase === i }">
            <i class="note big" :class="phase >= 0 && i > phase ? 'ghost' : s.note" />
            <b>{{ L(s.zh, s.ja) }}</b>
            <span class="t-caption">{{ L(s.dzh, s.dja) }}</span>
          </li>
        </ol>
      </section>

      <div class="cols">
        <div class="main">
          <!-- 同步目标 -->
          <section>
            <div class="section-head"><h2 class="t-h2">{{ L('同步目标', '連携先') }}</h2></div>
            <ul class="panel rows">
              <li v-for="t in targets" :key="t.key" class="tg">
                <div class="grow">
                  <p class="tg-name">
                    <b>{{ tname(t) }}</b>
                    <span v-if="t.locked" class="tag">{{ L('始终开启', '常にオン') }}</span>
                  </p>
                  <p class="tg-res">
                    <template v-if="!t.on">{{ L('未开启', 'オフ') }}</template>
                    <template v-else-if="t.state === 'ok'">
                      <span class="tag tag-ok">{{ L('成功', '成功') }}</span>
                      <span class="num">{{ t.at }}</span>
                    </template>
                    <template v-else-if="t.state === 'fail'">
                      <span class="tag tag-don">{{ L('失败', '失敗') }}</span>
                      <span>{{ L(t.zh, t.ja) }}</span>
                    </template>
                    <template v-else-if="t.state === 'busy'">{{ L('重试中…', '再試行中…') }}</template>
                    <template v-else>{{ L('下次同步时推送', '次回の同期から送信') }}</template>
                  </p>
                </div>
                <button v-if="t.on && t.state === 'fail'" class="btn btn-sm" @click="retry(t)">{{ L('重试', '再試行') }}</button>
                <button class="sw" role="switch" :aria-checked="t.on" :aria-label="tname(t)" :disabled="t.locked" @click="toggle(t)"><i /></button>
              </li>
            </ul>
          </section>

          <!-- 最近同步 -->
          <section class="section">
            <div class="section-head"><h2 class="t-h2">{{ L('最近同步', '最近の同期') }}</h2></div>
            <div class="panel">
              <EmptyLane v-if="!history.length" compact :title="L('还没有同步记录', '同期履歴はまだありません')">
                <button class="btn btn-primary" :disabled="store.syncing" @click="runSync">{{ L('立即同步', '今すぐ同期') }}</button>
              </EmptyLane>
              <template v-else>
                <div class="only-desktop scroll-x">
                  <table class="dt">
                    <thead>
                      <tr>
                        <th>{{ L('时间', '日時') }}</th>
                        <th class="r">{{ L('新记录', '新しい記録') }}</th>
                        <th class="r">{{ L('最好成绩', '自己ベスト') }}</th>
                        <th class="r">{{ L('全连', 'フルコンボ') }}</th>
                        <th class="r">{{ L('全良', '全良') }}</th>
                        <th class="r">{{ L('用时', '所要時間') }}</th>
                        <th>{{ L('状态', '状態') }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="h in history" :key="h.id">
                        <td class="num">{{ h.time }}</td>
                        <td class="r num big" :class="{ faint: !h.records }">{{ h.records }}</td>
                        <td class="r num" :class="{ faint: !h.pb }">{{ h.pb }}</td>
                        <td class="r num" :class="{ faint: !h.fc }">{{ h.fc }}</td>
                        <td class="r num" :class="{ faint: !h.dfc }">{{ h.dfc }}</td>
                        <td class="r"><span class="num">{{ h.dur.toFixed(1) }}</span> {{ L('秒', '秒') }}</td>
                        <td>
                          <span v-if="h.ok" class="tag tag-ok">{{ L('成功', '成功') }}</span>
                          <span v-else class="fail"><span class="tag tag-don">{{ L('失败', '失敗') }}</span>{{ L(h.zh, h.ja) }}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <ul class="only-mobile rows">
                  <li v-for="h in history" :key="h.id" class="hrow">
                    <div class="spread">
                      <span class="num">{{ h.time }}</span>
                      <span class="tag" :class="h.ok ? 'tag-ok' : 'tag-don'">{{ h.ok ? L('成功', '成功') : L('失败', '失敗') }}</span>
                    </div>
                    <p v-if="h.ok" class="hstats">
                      <span>{{ L('新记录', '新しい記録') }}<b class="num">{{ h.records }}</b></span>
                      <span>{{ L('最好成绩', '自己ベスト') }}<b class="num">{{ h.pb }}</b></span>
                      <span>{{ L('全连', 'フルコンボ') }}<b class="num">{{ h.fc }}</b></span>
                      <span>{{ L('全良', '全良') }}<b class="num">{{ h.dfc }}</b></span>
                    </p>
                    <p v-else class="t-small">{{ L(h.zh, h.ja) }}</p>
                  </li>
                </ul>
              </template>
            </div>
          </section>
        </div>

        <aside class="side">
          <!-- 网页成绩 token -->
          <section>
            <div class="section-head">
              <h2 class="t-h2">{{ L('网页成绩 token', 'Web スコアトークン') }}</h2>
              <RouterLink to="/account/developer" class="more">{{ L('token 使用说明', 'トークンの使い方') }}</RouterLink>
            </div>
            <div class="panel panel-pad col">
              <template v-if="tokenTail">
                <code class="num token">{{ masked }}</code>
                <div class="row-wrap">
                  <button class="btn btn-sm" @click="copyToken"><Icon name="copy" :size="14" />{{ L('复制', 'コピー') }}</button>
                  <button class="btn btn-sm" @click="regenToken">{{ L('重新生成', '再発行') }}</button>
                  <button class="btn btn-sm btn-ghost" @click="revokeToken">{{ L('吊销', '失効させる') }}</button>
                </div>
              </template>
              <template v-else>
                <p class="t-small">{{ L('没有可用的 token。', '有効なトークンはありません。') }}</p>
                <button class="btn" @click="regenToken"><Icon name="key" :size="16" />{{ L('生成 token', 'トークンを発行') }}</button>
              </template>
            </div>
          </section>

          <!-- 从菌菌控制台迁移 -->
          <section class="section">
            <div class="section-head"><h2 class="t-h2">{{ L('从菌菌控制台迁移', 'Kinoko コンソールから移行') }}</h2></div>
            <form class="panel panel-pad col" @submit.prevent="startMigrate">
              <div class="field">
                <label for="mig-key">API key</label>
                <input id="mig-key" v-model="mig.key" class="input num" :class="{ 'is-error': mig.error }" placeholder="kk_…" autocomplete="off" @input="mig.error = ''" />
                <span v-if="mig.error" class="field-error">{{ mig.error }}</span>
                <span v-else class="field-hint">{{ L('只用来读取一次历史成绩，迁移后不会保存。', '過去のスコアを一度読み込むためだけに使い、移行後は保存しません。') }}</span>
              </div>
              <button type="submit" class="btn btn-ink">{{ L('开始迁移', '移行を開始') }}</button>
            </form>
          </section>
        </aside>
      </div>
    </template>
  </div>
</template>

<style scoped>
.top-main {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  padding: var(--sp-5) var(--sp-6);
}
.stamp {
  display: inline-grid;
  place-items: center;
  flex: none;
  width: 48px;
  height: 48px;
  border-radius: var(--r-ctl);
  border: 1.5px solid currentColor;
  background: var(--don-wash);
  color: var(--don-ink);
  font-family: var(--font-num);
  font-size: var(--fs-16);
  font-weight: 700;
  letter-spacing: 0.04em;
}
.id {
  margin-left: 10px;
  font-size: var(--fs-16);
  color: var(--ink-2);
}
.last {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 16px;
  margin-top: 2px;
}
.last b {
  color: var(--ink);
}
.go {
  min-width: 168px;
}
.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 三步流程：音符沿一条虚线前进 */
.flow {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--sp-3);
  padding: var(--sp-5) var(--sp-4) var(--sp-5);
  border-top: 1px solid var(--line);
}
.flow::before {
  content: '';
  position: absolute;
  left: 16.67%;
  right: 16.67%;
  top: calc(var(--sp-5) + 13px);
  border-top: 2px dashed var(--line-strong);
}
.flow li {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  text-align: center;
  transition: opacity var(--dur-2);
}
.flow .note {
  --n: 28px;
  margin-bottom: 8px;
  transition: transform var(--dur-2) var(--ease-hit);
}
.flow .note.ghost {
  background: var(--surface);
}
.flow li.wait b,
.flow li.wait span {
  opacity: 0.55;
}
.flow li.now .note {
  transform: scale(1.18);
}

.cols {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  align-items: start;
  gap: var(--sp-8);
  margin-top: var(--sp-10);
}
.main,
.side {
  min-width: 0;
}
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
  min-height: 68px;
  padding: var(--sp-3) var(--sp-5);
}
.tg-name {
  display: flex;
  align-items: center;
  gap: 8px;
}
.tg-res {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 8px;
  margin-top: 2px;
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.sw {
  position: relative;
  flex: none;
  width: 44px;
  height: 26px;
  border-radius: var(--r-note);
  background: var(--line-strong);
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
  background: var(--ai-0);
  transition: transform var(--dur-2) var(--ease-out);
}
.sw[aria-checked='true'] {
  background: var(--ka);
}
.sw[aria-checked='true'] i {
  transform: translateX(18px);
}
.sw[disabled] {
  opacity: 0.55;
  cursor: default;
}
.sw:focus-visible {
  border-radius: var(--r-note);
}
.panel > .scroll-x {
  border-radius: inherit;
}
.dt .big {
  font-size: var(--fs-16);
}
.fail {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--ink-2);
}
.hrow {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: var(--sp-3) var(--sp-4);
}
.hstats {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 16px;
  font-size: var(--fs-12);
  color: var(--ink-3);
}
.hstats b {
  margin-left: 5px;
  font-size: var(--fs-16);
  color: var(--ink);
}
.token {
  display: block;
  padding: 10px 12px;
  border-radius: var(--r-ctl);
  background: var(--bg-sunk);
  font-size: var(--fs-16);
  overflow-wrap: anywhere;
}

@media (max-width: 1099px) {
  .cols {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--sp-10);
  }
}
@media (max-width: 767px) {
  .top-main {
    flex-wrap: wrap;
    padding: var(--sp-4);
  }
  .go {
    width: 100%;
  }
  .flow {
    padding: var(--sp-4) var(--sp-2);
  }
  .flow::before {
    top: calc(var(--sp-4) + 13px);
  }
  .tg {
    padding: var(--sp-3) var(--sp-4);
  }
  .cols {
    margin-top: var(--sp-8);
    gap: var(--sp-8);
  }
}
</style>
