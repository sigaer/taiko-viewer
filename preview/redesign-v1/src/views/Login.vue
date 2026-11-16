<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Icon from '../components/Icon.vue'
import Logo from '../components/Logo.vue'
import Lane from '../components/Lane.vue'
import { laneDays, FACT, songById } from '../mock/data'
import { store, L, toast, songTitle } from '../store'
import { useQueryState } from '../routeState'

// 登录 / 注册 / 找回密码共用一页：模式写在地址 ?mode= 里；同一组字段按模式增减，切换时不丢已填的邮箱。
const router = useRouter()
const MODES = ['login', 'register', 'reset']
const q = useQueryState({ mode: { type: 'string', default: 'login', values: MODES } })
const mode = computed(() => q.mode)

const form = reactive({ username: '', email: '', code: '', password: '' })
const errors = reactive({ username: '', email: '', code: '', password: '' })
const serverError = ref(false)
const showPw = ref(false)
const resetDone = ref(false)
const sent = ref(false)
const left = ref(0)
let timer = null
let alive = true

const FIELDS = { login: ['email', 'password'], register: ['username', 'email', 'code', 'password'], reset: ['email', 'code', 'password'] }
const has = (f) => FIELDS[mode.value].includes(f)
// 软键盘的回车键：最后一个字段是「前往 / 完成」，其他是「下一项」
const enterHint = (f) => (FIELDS[mode.value].at(-1) === f ? (mode.value === 'login' ? 'go' : 'done') : 'next')

const head = computed(() => ({ login: L('欢迎回来', 'おかえりなさい'), register: L('创建账号', 'アカウント作成'), reset: L('重设密码', 'パスワード再設定') })[mode.value])
const submitLabel = computed(() => ({ login: L('登录', 'ログイン'), register: L('创建账号', 'アカウントを作成'), reset: L('更新密码', 'パスワードを更新') })[mode.value])
const codeLabel = computed(() => {
  if (left.value > 0) return L(`${left.value} 秒后可重发`, `${left.value} 秒後に再送信`)
  return sent.value ? L('重新发送', '再送信') : L('发送验证码', '認証コードを送信')
})

function resetState() {
  serverError.value = false
  resetDone.value = false
  form.password = ''
  form.code = ''
  for (const k in errors) errors[k] = ''
}
// 地址里的模式变化（按钮、浏览器前进后退）都走这里
watch(mode, resetState)
function switchTo(m) {
  if (m === q.mode) resetState()
  else q.mode = m
}

function check(f) {
  let msg = ''
  if (f === 'username') {
    const n = form.username.trim().length
    if (n < 2 || n > 16) msg = L('用户名需要 2–16 个字符。', 'ユーザー名は 2〜16 文字で入力してください。')
  } else if (f === 'email') {
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) msg = L('邮箱格式不对，例如 name@example.com。', 'メールアドレスの形式が違います（例：name@example.com）。')
  } else if (f === 'code') {
    if (!/^\d{6}$/.test(form.code.trim())) msg = L('请输入邮件里的 6 位数字验证码。', 'メールに記載の 6 桁のコードを入力してください。')
  } else if (f === 'password') {
    // 演示：登录时输入 wrong 走「服务端拒绝」分支，不被长度校验拦下
    const demoReject = mode.value === 'login' && form.password === 'wrong'
    if (form.password.length < 6 && !demoReject) msg = L('密码至少 6 位。', 'パスワードは 6 文字以上です。')
  }
  errors[f] = msg
  return !msg
}
function touch(f) {
  if (form[f]) check(f)
}
function focusField(f) {
  const el = document.getElementById(`f-${f}`)
  if (!el) return
  el.focus()
  el.scrollIntoView({ block: 'center' })
}

function sendCode() {
  if (left.value > 0) return
  if (!check('email')) return focusField('email')
  sent.value = true
  left.value = 60
  toast(L(`验证码已发送到 ${form.email.trim()}`, `認証コードを ${form.email.trim()} に送信しました`))
  clearInterval(timer)
  timer = setInterval(() => {
    if (!alive) return clearInterval(timer)
    left.value -= 1
    if (left.value <= 0) {
      clearInterval(timer)
      timer = null
    }
  }, 1000)
}
onBeforeUnmount(() => {
  alive = false
  clearInterval(timer)
})

function submit() {
  serverError.value = false
  const bad = FIELDS[mode.value].filter((f) => !check(f))
  if (bad.length) return focusField(bad[0])
  if (mode.value === 'login') {
    if (form.password === 'wrong') {
      serverError.value = true
      nextTick(() => document.getElementById('f-server-err')?.focus())
      return
    }
    store.auth = 'ready'
    router.push('/')
  } else if (mode.value === 'register') {
    store.auth = 'unbound'
    router.push('/bind')
  } else {
    resetDone.value = true
  }
}
function oidc() {
  store.auth = 'ready'
  router.push('/')
}

/* 右侧示例谱面：最近 21 天（laneDays 按时间先后，今天在最后） */
const days21 = laneDays.slice(-21)
const sel = ref(0)
const day = computed(() => days21.find((d) => d.daysAgo === sel.value) || days21[days21.length - 1])
const dayLabel = computed(() => {
  const d = day.value
  if (d.daysAgo === 0) return L('今天', '今日')
  return L(`${d.date.getMonth() + 1} 月 ${d.date.getDate()} 日`, `${d.date.getMonth() + 1}月${d.date.getDate()}日`)
})
function noteClass(f) {
  const n = FACT[f.type].note
  if (n === 'dfc' || n === 'fc') return 'big'
  if (n === 'goal') return 'big roll'
  return n === 'ka' ? 'ka' : n === 'ghost' ? 'ghost' : ''
}
</script>

<template>
  <div class="auth">
    <div class="side">
      <header class="top">
        <RouterLink to="/" class="brand" :aria-label="L('Taiko Viewer 首页', 'Taiko Viewer ホーム')"><Logo :size="32" /><span>Taiko Viewer</span></RouterLink>
        <div class="row top-acts">
          <button class="btn btn-ghost btn-sm" type="button" :lang="store.locale === 'zh' ? 'ja' : 'zh-CN'" @click="store.locale = store.locale === 'zh' ? 'ja' : 'zh'">{{ store.locale === 'zh' ? '日本語' : '中文' }}</button>
          <RouterLink to="/" class="btn btn-ghost btn-sm"><Icon name="chevL" :size="16" />{{ L('返回首页', 'ホームへ') }}</RouterLink>
        </div>
      </header>

      <div class="m-lane stage" aria-hidden="true">
        <i class="judge" /><i class="note big" /><i class="note ka" /><i class="note" /><i class="note ka" /><i class="note big roll" /><i class="note" />
      </div>

      <main class="body">
        <h1 class="t-h1">{{ head }}</h1>

        <div class="seg modes" role="group" :aria-label="L('选择操作', '操作を選択')">
          <button type="button" :aria-pressed="mode === 'login'" @click="switchTo('login')">{{ L('登录', 'ログイン') }}</button>
          <button type="button" :aria-pressed="mode === 'register'" @click="switchTo('register')">{{ L('注册', '新規登録') }}</button>
          <button type="button" :aria-pressed="mode === 'reset'" @click="switchTo('reset')">{{ L('找回密码', 'パスワード再設定') }}</button>
        </div>

        <!-- 找回密码：成功 -->
        <div v-if="mode === 'reset' && resetDone" class="done" role="status">
          <span class="done-mark"><Icon name="check" :size="18" /></span>
          <h2 class="t-h2">{{ L('密码已更新', 'パスワードを更新しました') }}</h2>
          <p class="t-small">{{ L('其他设备上的登录已退出。用新密码重新登录即可。', '他の端末からはログアウトされました。新しいパスワードでログインしてください。') }}</p>
          <button type="button" class="btn btn-primary btn-lg btn-block" @click="switchTo('login')">{{ L('用新密码登录', '新しいパスワードでログイン') }}</button>
        </div>

        <form v-else class="form" novalidate @submit.prevent="submit">
          <div v-if="serverError" id="f-server-err" class="alert" role="alert" tabindex="-1">
            <Icon name="warn" :size="18" />
            <div>
              <p>{{ L('邮箱或密码不正确。可以重置密码，或换一种登录方式。', 'メールアドレスまたはパスワードが違います。パスワードを再設定するか、別の方法でログインしてください。') }}</p>
              <button type="button" class="link" @click="switchTo('reset')">{{ L('重置密码', 'パスワードを再設定') }}</button>
            </div>
          </div>

          <div v-if="has('username')" class="field">
            <label for="f-username">{{ L('用户名', 'ユーザー名') }}</label>
            <input
              id="f-username"
              v-model="form.username"
              class="input"
              :class="{ 'is-error': errors.username }"
              type="text"
              autocomplete="username"
              autocapitalize="off"
              spellcheck="false"
              :enterkeyhint="enterHint('username')"
              maxlength="16"
              :aria-invalid="!!errors.username"
              :aria-describedby="errors.username ? 'f-username-err' : 'f-username-hint'"
              @blur="touch('username')"
            />
            <p v-if="errors.username" id="f-username-err" class="field-error" role="alert">{{ errors.username }}</p>
            <p v-else id="f-username-hint" class="field-hint">{{ L('显示在社区和个人主页，2–16 个字符。', 'コミュニティとプロフィールに表示されます（2〜16 文字）。') }}</p>
          </div>

          <div class="field">
            <label for="f-email">{{ L('邮箱', 'メールアドレス') }}</label>
            <input
              id="f-email"
              v-model="form.email"
              class="input"
              :class="{ 'is-error': errors.email }"
              type="email"
              inputmode="email"
              :autocomplete="mode === 'login' ? 'username' : 'email'"
              autocapitalize="off"
              spellcheck="false"
              :enterkeyhint="enterHint('email')"
              placeholder="name@example.com"
              :aria-invalid="!!errors.email"
              :aria-describedby="errors.email ? 'f-email-err' : undefined"
              @blur="touch('email')"
            />
            <p v-if="errors.email" id="f-email-err" class="field-error" role="alert">{{ errors.email }}</p>
          </div>

          <div v-if="has('code')" class="field">
            <label for="f-code">{{ L('邮箱验证码', '認証コード') }}</label>
            <div class="code-row">
              <input
                id="f-code"
                v-model="form.code"
                class="input num"
                :class="{ 'is-error': errors.code }"
                type="text"
                inputmode="numeric"
                pattern="[0-9]*"
                autocomplete="one-time-code"
                :enterkeyhint="enterHint('code')"
                maxlength="6"
                placeholder="000000"
                :aria-invalid="!!errors.code"
                :aria-describedby="errors.code ? 'f-code-err' : sent ? 'f-code-hint' : undefined"
                @blur="touch('code')"
              />
              <button type="button" class="btn" :disabled="left > 0" @click="sendCode">{{ codeLabel }}</button>
            </div>
            <p v-if="errors.code" id="f-code-err" class="field-error" role="alert">{{ errors.code }}</p>
            <p v-else-if="sent" id="f-code-hint" class="field-hint">{{ L('验证码 10 分钟内有效。没收到的话，看看垃圾邮件箱。', 'コードの有効期限は 10 分です。届かない場合は迷惑メールをご確認ください。') }}</p>
          </div>

          <div class="field">
            <label for="f-password">{{ mode === 'reset' ? L('新密码', '新しいパスワード') : L('密码', 'パスワード') }}</label>
            <div class="pw">
              <input
                id="f-password"
                v-model="form.password"
                class="input"
                :class="{ 'is-error': errors.password }"
                :type="showPw ? 'text' : 'password'"
                :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
                autocapitalize="off"
                spellcheck="false"
                :enterkeyhint="enterHint('password')"
                :aria-invalid="!!errors.password"
                :aria-describedby="errors.password ? 'f-password-err' : mode === 'login' ? undefined : 'f-password-hint'"
                @blur="touch('password')"
              />
              <button type="button" class="icon-btn pw-toggle" :class="{ on: showPw }" :aria-pressed="showPw" :aria-label="L('显示密码', 'パスワードを表示')" @click="showPw = !showPw"><Icon name="eye" :size="18" /></button>
            </div>
            <p v-if="errors.password" id="f-password-err" class="field-error" role="alert">{{ errors.password }}</p>
            <p v-else-if="mode !== 'login'" id="f-password-hint" class="field-hint">{{ L('至少 6 位', '6 文字以上') }}</p>
          </div>

          <button type="submit" class="btn btn-primary btn-lg btn-block">{{ submitLabel }}</button>

          <template v-if="mode !== 'reset'">
            <div class="or"><span>{{ L('或', 'または') }}</span></div>
            <button type="button" class="btn btn-lg btn-block" @click="oidc"><Icon name="key" :size="18" />{{ L('使用 OurTaiko 登录', 'OurTaiko でログイン') }}</button>
          </template>
        </form>

        <p v-if="!resetDone" class="t-small swap">
          <template v-if="mode === 'login'">{{ L('还没有账号？', 'アカウントをお持ちでない方は') }}<button type="button" class="link" @click="switchTo('register')">{{ L('注册', '新規登録') }}</button></template>
          <template v-else>{{ L('已经有账号？', 'アカウントをお持ちの方は') }}<button type="button" class="link" @click="switchTo('login')">{{ L('登录', 'ログイン') }}</button></template>
        </p>
      </main>
    </div>

    <!-- 示例谱面：最近 21 天 -->
    <aside class="stage login-stage on-lane" :aria-label="L('示例谱面', 'サンプル譜面')">
      <p class="stage-copy">{{ L('每次同步，都会在这里多出几个音符。', '同期するたび、ここに音符が増えていきます。') }}</p>
      <figure class="stage-demo">
        <Lane v-model="sel" :days="days21" compact :label="L('示例：一位玩家最近 21 天的练习', 'サンプル：あるプレイヤーの直近 21 日')" />
        <figcaption>
          <div class="stage-day">
            <b>{{ dayLabel }}</b>
            <span v-if="day.played"><span class="num">{{ day.charts }}</span> {{ L('张谱', '譜面') }}</span>
          </div>
          <ul v-if="day.facts.length" class="stage-facts">
            <li v-for="(f, i) in day.facts.slice(0, 3)" :key="i">
              <i class="note" :class="noteClass(f)" />
              <b>{{ L(FACT[f.type].zh, FACT[f.type].ja) }}</b>
              <span class="title-1l" :title="songTitle(songById[f.songId])">{{ songTitle(songById[f.songId]) }}</span>
            </li>
          </ul>
          <p v-else class="stage-rest">{{ day.played ? L('这天打了几首，没有新的记录。', 'この日は記録更新なし。') : L('这天没有游玩记录。', 'この日はプレイ記録がありません。') }}</p>
        </figcaption>
      </figure>
      <p class="stage-cap">{{ L('示例：一位玩家最近 21 天的练习', 'サンプル：あるプレイヤーの直近 21 日') }}</p>
    </aside>
  </div>
</template>

<style scoped>
.auth {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
  min-height: 100dvh;
}
.side {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 16px var(--gutter) 32px;
}
.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.top-acts {
  gap: 6px;
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
.body {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 20px;
  width: 100%;
  max-width: 400px;
  margin: 0 auto;
  padding: 32px 0;
}
.modes {
  display: flex;
}
.modes button {
  flex: 1;
  padding: 0 6px;
  white-space: nowrap;
}
.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.form :is(input, button) {
  scroll-margin: 96px 0 160px;
}
.alert {
  display: flex;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid var(--danger);
  border-radius: var(--r-ctl);
  background: var(--danger-wash);
  color: var(--danger);
  font-size: var(--fs-14);
}
.alert:focus-visible {
  outline-offset: 2px;
}
.alert p {
  color: var(--ink);
}
.alert .link {
  margin-top: 4px;
  min-height: 32px;
}
.code-row {
  display: flex;
  gap: 8px;
}
.code-row .input {
  flex: 1;
  min-width: 0;
  font-size: var(--fs-18);
  letter-spacing: 0.18em;
}
.code-row .btn {
  flex: none;
  height: auto;
  min-width: 124px;
  white-space: nowrap;
}
.pw {
  position: relative;
}
.pw .input {
  padding-right: 48px;
}
.pw-toggle {
  position: absolute;
  top: 50%;
  right: 2px;
  width: 36px;
  height: 36px;
  transform: translateY(-50%);
  color: var(--ink-2);
}
.pw-toggle.on {
  color: var(--ka-ink);
}
.pw-toggle.on::after {
  /* 密码可见时，眼睛上加一道斜线：再点一次就隐藏 */
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 22px;
  height: 1.75px;
  margin: -1px 0 0 -11px;
  border-radius: 1px;
  background: currentColor;
  transform: rotate(-45deg);
}
.or {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.or::before,
.or::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--line);
}
.swap {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 4px;
}
.swap .link {
  min-height: 44px;
  padding: 0 6px;
}
.done {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 0;
}
.done-mark {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  margin-bottom: 4px;
  border-radius: 50%;
  background: var(--ok-wash);
  color: var(--ok);
}
.done .btn {
  margin-top: 12px;
}

/* ---------- 右侧：谱面（舞台面 .stage 深藍底，示例数据；局部 --ink / --line 由 .stage 提供） ---------- */
.stage {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 28px;
  min-width: 0;
  margin: 16px 16px 16px 0;
  padding: 48px clamp(24px, 4vw, 64px);
  border-radius: var(--r-panel);
}
.stage-copy {
  max-width: 14em;
  font-size: clamp(1.5rem, 2.4vw, 2.25rem);
  font-weight: 900;
  line-height: var(--lh-snug);
  text-wrap: balance;
}
.stage-demo {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}
.stage-demo :deep(.lane) {
  border: 1px solid var(--line);
}
.stage-demo figcaption {
  min-height: 132px;
  padding: 0 6px;
}
.stage-day {
  display: flex;
  align-items: baseline;
  gap: 12px;
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.stage-day b {
  font-size: var(--fs-16);
  font-weight: 900;
  color: var(--ink);
}
.stage-facts li {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 9px 0;
  border-bottom: 1px solid var(--line);
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.stage-facts li:last-child {
  border-bottom: 0;
}
.stage-facts b {
  flex: none;
  color: var(--ink);
}
.stage-facts .note.ghost {
  box-shadow: inset 0 0 0 1.5px var(--line);
}
.stage-rest {
  padding: 9px 0;
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.stage-cap {
  font-size: var(--fs-12);
  color: var(--ink-3);
}

/* ---------- 窄屏：只留表单，顶部一条谱面 ---------- */
.m-lane {
  display: none;
  position: relative;
  /* 同时带 .stage（深色舞台面 token），要盖掉本页桌面舞台 .stage 的纵向排布与内边距 */
  flex-direction: row;
  justify-content: flex-start;
  min-width: 0;
  align-items: center;
  gap: 16px;
  height: 44px;
  margin-top: 16px;
  padding: 0 16px 0 58px;
  border-radius: var(--r-note);
  overflow: hidden;
}
.m-lane::before {
  content: '';
  position: absolute;
  inset: 9px 0;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}
.m-lane .judge {
  position: absolute;
  left: 12px;
  top: 7px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 2px solid var(--ink-2);
}
.m-lane .note {
  position: relative;
}
@media (max-width: 1099px) {
  .auth {
    grid-template-columns: minmax(0, 1fr);
  }
  .stage {
    display: none;
  }
  .m-lane {
    display: flex;
  }
  .body {
    justify-content: flex-start;
  }
}
@media (max-width: 767px) {
  .side {
    padding-top: 10px;
    padding-bottom: 24px;
  }
  .brand span {
    display: none;
  }
  /* D7：只剩标志时可点区域仍是 44×44 */
  .brand {
    min-width: var(--hit);
    justify-content: center;
  }
  .m-lane {
    margin-top: 8px;
    height: 36px;
  }
  .m-lane .judge {
    top: 3px;
  }
  .body {
    max-width: none;
    gap: 16px;
    padding: 20px 0;
  }
  .pw .input {
    padding-right: 52px;
  }
  .pw-toggle {
    width: 44px;
    height: 44px;
    right: 1px;
  }
}
</style>
