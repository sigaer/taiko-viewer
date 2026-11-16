<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Icon from '../components/Icon.vue'
import Logo from '../components/Logo.vue'
import EmptyLane from '../components/EmptyLane.vue'
import { player, fmt } from '../mock/data'
import { store, L } from '../store'
import { useQueryState } from '../routeState'
import { sync, startSync, failedTargets, SYNC_PHASES } from '../sync'

// 绑定引导：三步真实顺序（输入 ID → 改称号验证 → 首次同步）。当前步骤写在地址 ?step= 里。
const router = useRouter()
const q = useQueryState({ step: { type: 'number', default: 1, values: [1, 2, 3] } })
if (store.auth === 'empty' && q.step === 1) q.step = 3
const step = computed(() => q.step)
const STEPS = computed(() => [
  { n: 1, label: L('输入 ID', 'ID を入力') },
  { n: 2, label: L('验证称号', '称号で確認') },
  { n: 3, label: L('同步成绩', '成績を同期') },
])
const headEl = ref(null)
const timers = []
let alive = true
const later = (fn, ms) =>
  timers.push(
    setTimeout(() => {
      if (alive) fn()
    }, ms),
  )
onBeforeUnmount(() => {
  alive = false
  timers.forEach(clearTimeout)
})

watch(step, () => {
  titleUnchanged.value = false
  nextTick(() => headEl.value?.focus())
})
function goStep(n) {
  q.step = n
}

/* ① ID */
const ID_LEN = 12
const taikoId = ref('')
const idError = ref('')
const helpOpen = ref(false)
const looking = ref(false)
const masked = computed(() => {
  const v = taikoId.value
  return /^\d{8,}$/.test(v) ? `${v.slice(0, 4)}••••${v.slice(-4)}` : ''
})
function validateId() {
  const v = taikoId.value.trim()
  if (!v) idError.value = L('请输入鼓众广场 ID。', '鼓衆広場 ID を入力してください。')
  else if (/\D/.test(v)) idError.value = L('ID 只包含数字，请去掉空格和其他字符。', 'ID は数字のみです。空白や記号を取り除いてください。')
  else if (v.length !== ID_LEN) idError.value = L(`鼓众广场 ID 是 ${ID_LEN} 位数字，现在是 ${v.length} 位。`, `鼓衆広場 ID は ${ID_LEN} 桁です（現在 ${v.length} 桁）。`)
  else idError.value = ''
  return !idError.value
}
function onIdInput() {
  if (idError.value) validateId()
}
function submitId() {
  taikoId.value = taikoId.value.trim()
  if (!validateId()) return document.getElementById('bind-id')?.focus()
  looking.value = true
  later(() => {
    looking.value = false
    goStep(2)
  }, 700)
}

/* ② 称号 */
const RECORDED_TITLE = '太鼓新人'
const tries = ref(0)
const checking = ref(false)
const titleUnchanged = ref(false)
function confirmTitle() {
  checking.value = true
  titleUnchanged.value = false
  later(() => {
    checking.value = false
    tries.value += 1
    if (tries.value < 2) {
      titleUnchanged.value = true
      return
    }
    if (store.auth === 'unbound') store.auth = 'empty'
    goStep(3)
  }, 900)
}

/* ③ 首次同步：全站唯一的同步状态机（S1），结果由原型面板的「下一次同步结果」决定 */
const started = ref(false)
const outcome = ref('') // success | partial | failed（本页发起的这次同步）
watch(
  () => sync.state,
  (st, prev) => {
    if (started.value && prev === 'running' && ['success', 'partial', 'failed'].includes(st)) outcome.value = st
  },
)
const phase3 = computed(() => {
  if (!started.value) return 'idle'
  if (sync.state === 'running') return 'running'
  return outcome.value || 'idle'
})
const failedNames = computed(() =>
  failedTargets()
    .map((t) => L(t.zh, t.ja))
    .join(L('、', '・')),
)
const failedReason = computed(() => {
  const t = failedTargets()[0]
  return t ? L(t.reasonZh, t.reasonJa) : ''
})
function beginSync(opts) {
  if (store.auth === 'unbound') store.auth = 'empty'
  started.value = true
  outcome.value = ''
  startSync(opts)
}
const progressText = computed(() => (phase3.value === 'running' ? L(`正在同步，第 ${sync.phase + 1} 步，共 3 步`, `同期中（${sync.phase + 1}/3）`) : ''))
// 合计全部由成绩数据推出（M3）
const totals = computed(() => [
  { k: L('有成绩的谱面', '記録のある譜面'), v: player.scoredCharts },
  { k: L('通关', 'クリア'), v: player.crownCounts.clear },
  { k: L('全连', 'フルコンボ'), v: player.crownCounts.fc },
  { k: L('全良', '全良'), v: player.crownCounts.dfc },
])
function enter() {
  store.auth = 'ready'
  router.push('/')
}
</script>

<template>
  <div class="bind">
    <header class="top">
      <RouterLink to="/" class="brand" :aria-label="L('Taiko Viewer 首页', 'Taiko Viewer ホーム')"><Logo :size="32" /><span>Taiko Viewer</span></RouterLink>
      <RouterLink to="/" class="btn btn-ghost btn-sm">{{ L('稍后再说', 'あとで') }}</RouterLink>
    </header>

    <main class="wrap">
      <EmptyLane v-if="store.auth === 'guest'" :title="L('先登录，再绑定', '連携の前にログイン')" :text="L('绑定关系保存在 Viewer 账号上。', '連携情報は Viewer アカウントに保存されます。')">
        <RouterLink to="/login" class="btn btn-primary">{{ L('登录', 'ログイン') }}</RouterLink>
        <RouterLink to="/login?mode=register" class="btn">{{ L('注册', '新規登録') }}</RouterLink>
      </EmptyLane>

      <template v-else>
        <h1 class="t-h1">{{ L('绑定鼓众广场 ID', '鼓衆広場 ID を連携') }}</h1>

        <ol class="stepper" :aria-label="L('绑定步骤', '連携の手順')">
          <li v-for="s in STEPS" :key="s.n" :class="{ done: s.n < step, now: s.n === step }" :aria-current="s.n === step ? 'step' : undefined">
            <i class="note" :class="s.n < step ? 'ka' : s.n === step ? '' : 'ghost'">
              <Icon v-if="s.n < step" name="check" :size="14" />
              <span v-else class="num">{{ s.n }}</span>
            </i>
            <span class="lbl">{{ s.label }}<span v-if="s.n < step" class="sr-only">{{ L('（已完成）', '（完了）') }}</span></span>
          </li>
        </ol>

        <!-- ① 输入 ID -->
        <section v-if="step === 1" class="panel card" aria-labelledby="bind-h1">
          <h2 id="bind-h1" ref="headEl" class="t-h2" tabindex="-1">{{ L('输入鼓众广场 ID', '鼓衆広場 ID を入力') }}</h2>
          <form class="col form" novalidate @submit.prevent="submitId">
            <div class="field">
              <label for="bind-id">{{ L('鼓众广场 ID', '鼓衆広場 ID') }}</label>
              <input
                id="bind-id"
                v-model="taikoId"
                class="input num id-input"
                :class="{ 'is-error': idError }"
                type="text"
                inputmode="numeric"
                pattern="[0-9]*"
                autocomplete="off"
                enterkeyhint="go"
                :maxlength="ID_LEN + 4"
                :placeholder="'0'.repeat(ID_LEN)"
                :aria-invalid="!!idError"
                :aria-describedby="idError ? 'bind-id-err' : 'bind-id-hint'"
                @input="onIdInput"
              />
              <p v-if="idError" id="bind-id-err" class="field-error" role="alert">{{ idError }}</p>
              <p v-else id="bind-id-hint" class="field-hint">
                <template v-if="masked">{{ L('其他人看到的是', '他の人には次のように表示されます：') }} <b class="num">{{ masked }}</b></template>
                <template v-else>{{ L(`${ID_LEN} 位数字。`, `${ID_LEN} 桁の数字です。`) }}</template>
              </p>
            </div>
            <div>
              <button type="button" class="link help-btn" :aria-expanded="helpOpen" aria-controls="bind-help" @click="helpOpen = !helpOpen">
                {{ L('在哪里找到我的 ID？', 'ID はどこで確認できますか？') }}<Icon :name="helpOpen ? 'chevU' : 'chevD'" :size="14" />
              </button>
              <ol v-show="helpOpen" id="bind-help" class="help">
                <li>{{ L('在微信里打开「鼓众广场」小程序，用机台上刷的那张卡登录。', 'WeChat で「鼓衆広場」ミニプログラムを開き、筐体で使っているカードでログインします。') }}</li>
                <li>{{ L('进入「我的」页面。', '「マイページ」を開きます。') }}</li>
                <li>{{ L(`昵称下方的 ${ID_LEN} 位数字就是 ID，长按可以复制。`, `ニックネームの下にある ${ID_LEN} 桁の数字が ID です。長押しでコピーできます。`) }}</li>
              </ol>
            </div>
            <button type="submit" class="btn btn-primary btn-lg act" :disabled="looking">{{ looking ? L('正在查找…', '検索中…') : L('查找这个 ID', 'この ID を検索') }}</button>
          </form>

          <div class="alt">
            <h3 class="alt-h">{{ L('其他绑定方式', 'ほかの連携方法') }}</h3>
            <ul>
              <li><RouterLink to="/account" class="link">{{ L('日服 Donder Hiroba 绑定', '日本版 ドンだーひろば を連携') }}</RouterLink></li>
              <li><RouterLink to="/account" class="link">{{ L('用 QQ 邮箱迁移机器人里的绑定', 'QQ メールで Bot の連携を引き継ぐ') }}</RouterLink></li>
              <li><RouterLink to="/account" class="link">{{ L('创建手动成绩账号', '手動記録用アカウントを作成') }}</RouterLink></li>
            </ul>
          </div>
        </section>

        <!-- ② 修改称号 -->
        <section v-else-if="step === 2" class="panel card" aria-labelledby="bind-h2">
          <h2 id="bind-h2" ref="headEl" class="t-h2" tabindex="-1">{{ L('修改游戏内称号以验证', 'ゲーム内の称号を変更して確認') }}</h2>
          <dl class="kv found">
            <dt>{{ L('鼓众广场 ID', '鼓衆広場 ID') }}</dt>
            <dd class="num">{{ masked || player.taikoIdMasked }}</dd>
            <dt>{{ L('昵称', 'ニックネーム') }}</dt>
            <dd>{{ player.nickname }}</dd>
          </dl>
          <div class="title-box">
            <span class="t-small">{{ L('我们记下的称号', '記録した現在の称号') }}</span>
            <b class="title-now title-wrap-2">「{{ RECORDED_TITLE }}」</b>
          </div>
          <ol class="todo">
            <li><span class="num">1</span>{{ L('在游戏里把称号换成任意一个别的称号，并保存。', 'ゲーム内で称号を別のものに変更し、保存します。') }}</li>
            <li><span class="num">2</span>{{ L('回到这里确认。验证通过后可以把称号换回来。', 'ここに戻って確認します。確認後は元の称号に戻せます。') }}</li>
          </ol>
          <p v-if="titleUnchanged" class="alert" role="alert">
            <Icon name="warn" :size="18" />
            <span>{{ L('称号还没有变化。在游戏里保存称号后，再点一次确认。', '称号がまだ変わっていません。ゲーム内で称号を保存してから、もう一度確認してください。') }}</span>
          </p>
          <div class="acts">
            <button type="button" class="btn btn-primary btn-lg act" :disabled="checking" @click="confirmTitle">{{ checking ? L('正在确认…', '確認中…') : L('我已修改称号，立即确认', '称号を変更しました。今すぐ確認') }}</button>
            <button type="button" class="btn btn-ghost btn-lg" :disabled="checking" @click="goStep(1)">{{ L('换一个 ID', '別の ID にする') }}</button>
          </div>
        </section>

        <!-- ③ 首次同步 -->
        <section v-else class="panel card" aria-labelledby="bind-h3">
          <h2 id="bind-h3" ref="headEl" class="t-h2" tabindex="-1">{{ L('同步第一份成绩', '最初の成績を同期') }}</h2>
          <p class="sr-only" aria-live="polite">{{ progressText }}</p>

          <template v-if="phase3 === 'idle'">
            <p class="row verified"><span class="tag tag-ok"><Icon name="check" :size="12" />{{ L('验证通过', '確認済み') }}</span><span class="num">{{ masked || player.taikoIdMasked }}</span></p>
            <p class="lead">{{ L('从鼓众广场读取全部成绩，第一次大约需要 10 秒。', '鼓衆広場からすべての成績を読み込みます。最初は 10 秒ほどかかります。') }}</p>
            <button type="button" class="btn btn-primary btn-lg act" :disabled="sync.state === 'running'" @click="beginSync()"><Icon name="sync" :size="18" />{{ L('开始同步', '同期を開始') }}</button>
          </template>

          <template v-else-if="phase3 === 'running'">
            <ol class="phases" :aria-label="L('同步进度', '同期の進行状況')">
              <li v-for="(p, i) in SYNC_PHASES" :key="p.key" :class="{ done: i < sync.phase, now: i === sync.phase }" :aria-current="i === sync.phase ? 'step' : undefined">
                <i class="mark">
                  <Icon v-if="i < sync.phase" name="check" :size="14" />
                  <template v-else>{{ i + 1 }}</template>
                </i>
                <span>{{ L(p.zh, p.ja) }}</span>
              </li>
            </ol>
            <button type="button" class="btn btn-primary btn-lg act" disabled>{{ L('正在同步…', '同期中…') }}</button>
          </template>

          <div v-else-if="phase3 === 'failed'" class="result">
            <p class="state bad" role="alert">
              <Icon name="warn" :size="18" />
              <span>{{ L('没有同步成功：鼓众广场暂时没有响应。已有的数据没有变化。', '同期できませんでした：鼓衆広場から応答がありません。データは変わっていません。') }}</span>
            </p>
            <div class="acts">
              <button type="button" class="btn btn-primary btn-lg act" @click="beginSync()"><Icon name="sync" :size="18" />{{ L('重试', '再試行') }}</button>
            </div>
          </div>

          <div v-else class="result">
            <p v-if="phase3 === 'partial'" class="state warn" role="status">
              <Icon name="warn" :size="18" />
              <span>
                <b>{{ L(`成绩已同步到 Viewer，${failedNames} 没有成功。`, `成績は Viewer に同期されました。${failedNames} への送信に失敗しました。`) }}</b>
                <span v-if="failedReason" class="t-small">{{ failedReason }}</span>
              </span>
            </p>
            <p v-else class="state ok" role="status">
              <Icon name="check" :size="18" />
              <b>{{ L('同步完成', '同期が完了しました') }}</b>
            </p>
            <dl class="sum">
              <div v-for="t in totals" :key="t.k">
                <dt>{{ t.k }}</dt>
                <dd class="num">{{ fmt(t.v) }}</dd>
              </div>
            </dl>
            <div class="acts">
              <button type="button" class="btn btn-primary btn-lg act" @click="enter">{{ L('进入今日', '「今日」へ進む') }}</button>
              <button v-if="phase3 === 'partial'" type="button" class="btn btn-lg" :disabled="sync.state === 'running'" @click="beginSync({ retryTargets: true })">{{ L('重试失败的目标', '失敗した連携先を再試行') }}</button>
            </div>
          </div>
        </section>
      </template>
    </main>
  </div>
</template>

<style scoped>
.bind {
  min-height: 100dvh;
  padding: 16px var(--gutter) 48px;
}
.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  font-size: var(--fs-16);
  font-weight: 900;
  border-radius: var(--r-note);
}
.wrap {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 560px;
  margin: 0 auto;
  padding-top: clamp(24px, 7vh, 72px);
}

/* ---------- Stepper：音符连成一条线 ---------- */
.stepper {
  display: flex;
}
.stepper li {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: var(--fs-14);
  color: var(--ink-2);
  text-align: center;
}
.stepper li + li::before {
  content: '';
  position: absolute;
  top: 14px;
  left: calc(-50% + 22px);
  right: calc(50% + 22px);
  height: 2px;
  border-radius: 1px;
  background: var(--line-strong);
}
.stepper li.done + li::before {
  background: var(--ka);
}
.stepper .note {
  --n: 30px;
  display: inline-grid;
  place-items: center;
  color: var(--ink-inv);
  font-size: var(--fs-13);
  line-height: 1;
}
.stepper .note.ghost {
  color: var(--ink-2);
}
/* D11：音符里的数字。朱色音符换 --don-solid 底（白字 ≥ 4.5:1）；浅葱 / 山吹音符上的数字用深色 */
.stepper .note:not(.ka, .roll, .ghost) {
  background: var(--don-solid);
}
.stepper .note:is(.ka, .roll) .num {
  color: var(--note-outline);
}
.stepper li.now {
  color: var(--ink);
  font-weight: 700;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
}
.card h2:focus-visible {
  box-shadow: none;
}
.form {
  gap: 16px;
}
.form :is(input, button) {
  scroll-margin: 96px 0 160px;
}
.id-input {
  height: 48px;
  font-size: var(--fs-22);
  letter-spacing: 0.08em;
}
.field-hint b {
  color: var(--ink);
  font-size: var(--fs-14);
}
.help-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 32px;
  font-size: var(--fs-14);
}
.help {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 10px;
  padding: 12px 14px 12px 32px;
  border-radius: var(--r-ctl);
  background: var(--bg-sunk);
  font-size: var(--fs-14);
  color: var(--ink-2);
  list-style: decimal;
}
.act {
  align-self: flex-start;
  white-space: nowrap;
}
.alt {
  padding-top: 16px;
  border-top: 1px solid var(--line);
}
.alt-h {
  font-size: var(--fs-13);
  font-weight: 500;
  color: var(--ink-2);
}
.alt ul {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 6px;
}
.alt .link {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  font-size: var(--fs-14);
}

.found {
  padding-bottom: 16px;
  border-bottom: 1px solid var(--line);
  font-size: var(--fs-14);
}
.found .num {
  font-size: var(--fs-16);
}
.title-box {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.title-box .t-small {
  color: var(--ink-2);
}
.title-now {
  margin-left: -0.5em;
  font-size: var(--fs-28);
  font-weight: 900;
  line-height: var(--lh-snug);
}
.todo {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: var(--fs-14);
}
.todo li {
  display: flex;
  gap: 10px;
}
.todo .num {
  flex: none;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--bg-sunk);
  font-size: var(--fs-13);
  color: var(--ink-2);
}
/* 需要你再做一步：山吹（注意），不是错误色 */
.alert {
  display: flex;
  gap: 10px;
  padding: 12px 14px;
  border-radius: var(--r-ctl);
  background: var(--roll-wash);
  color: var(--roll-ink);
  font-size: var(--fs-14);
}
.alert span {
  color: var(--ink);
}
.acts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.verified {
  gap: 10px;
}
.verified .num {
  font-size: var(--fs-16);
}
.lead {
  font-size: var(--fs-14);
  color: var(--ink-2);
}

/* 同步中：三个阶段 */
.phases {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.phases li {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: var(--fs-14);
  color: var(--ink-2);
}
.phases .mark {
  display: inline-grid;
  place-items: center;
  width: 24px;
  height: 24px;
  flex: none;
  border-radius: 50%;
  background: var(--bg-sunk);
  font-style: normal;
  font-size: var(--fs-12);
  font-weight: 700;
}
.phases li.done .mark {
  background: var(--ok-wash);
  color: var(--ok);
}
.phases li.now {
  color: var(--ink);
  font-weight: 700;
}
.phases li.now .mark {
  background: var(--ka-wash);
  color: var(--ka-ink);
  box-shadow: inset 0 0 0 1.5px var(--ka);
}

/* 结果 */
.result {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.state {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: var(--r-ctl);
  font-size: var(--fs-14);
}
.state > span {
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: var(--ink);
}
.state .t-small {
  color: var(--ink-2);
}
.state.ok {
  align-items: center;
  background: var(--ok-wash);
  color: var(--ok);
}
.state.ok b {
  color: var(--ink);
  font-size: var(--fs-16);
}
.state.warn {
  background: var(--roll-wash);
  color: var(--roll-ink);
}
.state.bad {
  border: 1px solid var(--danger);
  background: var(--danger-wash);
  color: var(--danger);
}
.state.bad > span {
  color: var(--ink);
}
.sum {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}
.sum div {
  display: flex;
  flex-direction: column-reverse;
  min-width: 0;
  padding: 16px 0 14px 16px;
  border-left: 1px solid var(--line);
}
.sum div:first-child {
  padding-left: 0;
  border-left: 0;
}
.sum dd {
  font-size: var(--fs-28);
  font-weight: 700;
  line-height: 1;
}
.sum dt {
  margin-top: 6px;
  font-size: var(--fs-13);
  color: var(--ink-2);
}

@media (max-width: 767px) {
  .bind {
    padding-top: 10px;
  }
  .brand span {
    display: none;
  }
  /* D7：只剩标志时可点区域仍是 44×44 */
  .brand {
    min-width: var(--hit);
    justify-content: center;
  }
  .wrap {
    gap: 20px;
    padding-top: 20px;
  }
  .card {
    padding: 20px 16px;
  }
  .id-input {
    height: 52px;
  }
  .act,
  .acts .btn {
    width: 100%;
  }
  .stepper li + li::before {
    left: calc(-50% + 20px);
    right: calc(50% + 20px);
  }
  .help-btn,
  .alt .link {
    min-height: 44px;
  }
  .sum {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .sum div:nth-child(3) {
    padding-left: 0;
    border-left: 0;
  }
  .sum div:nth-child(n + 3) {
    border-top: 1px solid var(--line);
  }
}
</style>
