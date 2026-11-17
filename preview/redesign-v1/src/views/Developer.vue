<script setup>
import { computed, reactive, ref } from 'vue'
import Icon from '../components/Icon.vue'
import Sheet from '../components/Sheet.vue'
import EmptyLane from '../components/EmptyLane.vue'
import { store, L, toast } from '../store'
import { useQueryState } from '../routeState'
import { useSectionNav } from '../sectionNav'

/* ---------- 申请状态（演示：三种状态由地址 ?state= 决定） ---------- */
const STATES = [
  { v: 'none', zh: '未申请', ja: '未申請' },
  { v: 'pending', zh: '审核中', ja: '審査中' },
  { v: 'approved', zh: '已通过', ja: '承認済み' },
]
const q = useQueryState({ state: { type: 'string', default: 'none', values: ['none', 'pending', 'approved'] } })
const status = computed({
  get: () => q.state,
  set: (v) => (q.state = v),
})
const submittedAt = ref('2026-11-14 21:08')
const form = reactive({ purpose: '', email: 'mochi.don@example.com', shots: [], errors: {} })
let shotSeq = 0
function addShot() {
  if (form.shots.length < 3) form.shots.push(`screenshot-${++shotSeq}.png`)
}
function submit() {
  form.errors = {}
  if (form.purpose.trim().length < 10) form.errors.purpose = L('请用至少 10 个字说明你打算做什么。', '用途を 10 文字以上で入力してください。')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) form.errors.email = L('邮箱格式不对，检查后再提交。', 'メールアドレスの形式を確認してください。')
  const firstBad = ['purpose', 'email'].find((k) => form.errors[k])
  if (firstBad) {
    document.getElementById(`dev-${firstBad}`)?.focus()
    return
  }
  submittedAt.value = '2026-11-16 20:46'
  status.value = 'pending'
  toast(L('申请已提交', '申請を送信しました'))
}
function withdraw() {
  status.value = 'none'
  toast(L('申请已撤回', '申請を取り下げました'))
}

/* ---------- API token ---------- */
const tail = ref('3f9a')
const masked = computed(() => `tvk_live_••••••••${tail.value}`)
function copyToken() {
  try {
    navigator.clipboard?.writeText(masked.value)
  } catch {
    /* 剪贴板不可用时忽略 */
  }
  toast(L('token 已复制', 'トークンをコピーしました'))
}
const randTail = () => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0')
function generate() {
  tail.value = randTail()
  toast(L('已生成 token', 'トークンを発行しました'))
}
const confirmKind = ref('') // regen | revoke
function runConfirm() {
  if (confirmKind.value === 'regen') {
    tail.value = randTail()
    toast(L('已生成新的 token，旧 token 已失效', '新しいトークンを発行しました。古いトークンは無効です'))
  } else if (confirmKind.value === 'revoke') {
    tail.value = ''
    toast(L('token 已吊销', 'トークンを失効させました'))
  }
  confirmKind.value = ''
}

/* ---------- 已注册应用 ---------- */
const SCOPES = ['profile:read', 'scores:read', 'history:read', 'growth:read', 'account:read']
const apps = ref([
  { id: 'clt_8f2c41d07b6ea91e', name: 'Donder Stats Bot', uri: 'https://stats.example.com/oidc/callback', scopes: ['scores:read', 'growth:read'], created: '2026-10-03' },
  { id: 'clt_17aa93c2e05d4b7f', name: '段位练习表', uri: 'https://dan.example.org/auth/cb', scopes: ['profile:read', 'scores:read', 'history:read'], created: '2026-11-02' },
])
const shortId = (id) => `${id.slice(0, 8)}…${id.slice(-4)}`
const regOpen = ref(false)
const reg = reactive({ name: '', uri: '', scopes: ['profile:read'], errors: {} })
function openReg() {
  Object.assign(reg, { name: '', uri: '', scopes: ['profile:read'], errors: {} })
  regOpen.value = true
}
function saveReg() {
  reg.errors = {}
  if (!reg.name.trim()) reg.errors.name = L('请填写应用名称，授权页会显示给用户。', 'アプリ名を入力してください。許可画面に表示されます。')
  if (!/^https:\/\/\S+$/.test(reg.uri.trim())) reg.errors.uri = L('回调地址需要以 https:// 开头。', 'リダイレクト URI は https:// で始めてください。')
  if (!reg.scopes.length) reg.errors.scopes = L('至少选择一项权限。', '権限を 1 つ以上選択してください。')
  if (Object.keys(reg.errors).length) return
  const hex = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
  apps.value.push({ id: `clt_${hex}`, name: reg.name.trim(), uri: reg.uri.trim(), scopes: [...reg.scopes], created: '2026-11-16' })
  regOpen.value = false
  toast(L('应用已注册', 'アプリを登録しました'))
}

/* ---------- 接口速查 ---------- */
const BASE = '/api/v1/taiko'
const ENDPOINTS = [
  { path: '/meta', zh: '难度、评价、王冠等字典', ja: '難易度・評価・王冠などの辞書' },
  { path: '/catalog/songs', zh: '曲库列表，含定数与谱面信息', ja: '楽曲一覧（定数・譜面情報つき）' },
  { path: '/players/{id}/scores', zh: '玩家成绩，需要 scores:read', ja: 'プレイヤーのスコア（scores:read が必要）' },
  { path: '/players/{id}/profile', zh: '玩家资料与 Rating，需要 profile:read', ja: 'プロフィールと Rating（profile:read が必要）' },
]
const PERKS = [
  { icon: 'key', zh: '一枚 API token，读取公开曲库与定数', ja: 'API トークン 1 件で公開楽曲と定数を取得' },
  { icon: 'shield', zh: '注册 OIDC 应用，经玩家授权读取成绩', ja: 'OIDC アプリを登録し、許可を得てスコアを取得' },
  { icon: 'book', zh: '完整 API 文档与变更通知', ja: 'API ドキュメント全文と変更のお知らせ' },
]
const REVIEW_STEPS = computed(() => [
  { n: 1, label: L('提交申请', '申請'), state: 'done' },
  { n: 2, label: L('站务审核', '審査'), state: 'now' },
  { n: 3, label: L('开通权限', '権限の付与'), state: 'todo' },
])

/* ---------- 页内目录（≥ 1100px 显示；随申请状态变化） ---------- */
const NAV = computed(() => {
  if (status.value === 'none')
    return [
      { id: 'dev-apply', label: L('申请开发者权限', '開発者権限を申請') },
      { id: 'dev-perks', label: L('通过后可以', '承認後にできること') },
    ]
  if (status.value === 'pending') return [{ id: 'dev-review', label: L('申请审核', '申請の審査') }]
  return [
    { id: 'dev-apps', label: L('已注册应用', '登録済みアプリ') },
    { id: 'dev-api', label: L('接口速查', 'エンドポイント') },
    { id: 'dev-token', label: 'API token' },
    { id: 'dev-oidc', label: 'OIDC Provider' },
  ]
})
const { current: currentSec, scrollTo } = useSectionNav(() => NAV.value.map((n) => n.id), { deps: [status, () => store.auth] })
</script>

<template>
  <div class="page dev">
    <EmptyLane v-if="store.auth === 'guest'" :title="L('登录后管理账号', 'ログインしてアカウントを管理')">
      <RouterLink to="/login" class="btn btn-primary">{{ L('登录', 'ログイン') }}</RouterLink>
    </EmptyLane>

    <div v-else class="vpage">
      <nav class="toc" :aria-label="L('本页目录', 'このページの目次')">
        <ul>
          <li v-for="n in NAV" :key="n.id">
            <button type="button" :aria-current="currentSec === n.id ? 'true' : undefined" @click="scrollTo(n.id)">{{ n.label }}</button>
          </li>
        </ul>
      </nav>

      <div class="vcol">
        <div class="demo">
          <span id="dev-demo-l" class="t-small">{{ L('演示状态', 'デモ状態') }}</span>
          <div class="seg" role="group" aria-labelledby="dev-demo-l">
            <button v-for="s in STATES" :key="s.v" type="button" :aria-pressed="status === s.v" @click="status = s.v">{{ L(s.zh, s.ja) }}</button>
          </div>
        </div>

        <!-- ============ 未申请 ============ -->
        <template v-if="status === 'none'">
          <section id="dev-apply" class="vsec" aria-labelledby="dev-apply-h">
            <div class="section-head">
              <h2 id="dev-apply-h" class="t-h2" tabindex="-1">{{ L('申请开发者权限', '開発者権限を申請') }}</h2>
              <span class="tag"><i class="ring" aria-hidden="true" />{{ L('未申请', '未申請') }}</span>
            </div>
            <form class="panel panel-pad col form" novalidate @submit.prevent="submit">
              <div class="field">
                <label for="dev-purpose">{{ L('用途', '用途') }}</label>
                <textarea
                  id="dev-purpose"
                  v-model="form.purpose"
                  class="textarea"
                  :class="{ 'is-error': form.errors.purpose }"
                  rows="4"
                  :placeholder="L('例如：给机厅群做一个查分机器人', '例：ゲーセン仲間向けのスコア検索ボット')"
                  :aria-invalid="!!form.errors.purpose"
                  :aria-describedby="form.errors.purpose ? 'dev-purpose-err' : undefined"
                />
                <span v-if="form.errors.purpose" id="dev-purpose-err" class="field-error" role="alert">{{ form.errors.purpose }}</span>
              </div>
              <div class="field">
                <label for="dev-email">{{ L('联系邮箱', '連絡先メール') }}</label>
                <input
                  id="dev-email"
                  v-model="form.email"
                  type="email"
                  inputmode="email"
                  autocomplete="email"
                  class="input"
                  :class="{ 'is-error': form.errors.email }"
                  :aria-invalid="!!form.errors.email"
                  :aria-describedby="form.errors.email ? 'dev-email-err' : undefined"
                />
                <span v-if="form.errors.email" id="dev-email-err" class="field-error" role="alert">{{ form.errors.email }}</span>
              </div>
              <div class="field">
                <span class="field-label">{{ L('截图', 'スクリーンショット') }}</span>
                <button type="button" class="drop" :disabled="form.shots.length >= 3" @click="addShot">
                  <Icon name="upload" :size="22" />
                  <b>{{ L('添加截图', 'スクリーンショットを追加') }}</b>
                  <span class="field-hint">{{ L('项目页面或原型，最多 3 张', 'プロジェクト画面や試作、3 枚まで') }}</span>
                </button>
                <ul v-if="form.shots.length" class="row-wrap shots">
                  <li v-for="(f, i) in form.shots" :key="f" class="chip">
                    <span class="num">{{ f }}</span>
                    <button type="button" class="x hit" :aria-label="L(`移除 ${f}`, `${f} を削除`)" @click="form.shots.splice(i, 1)"><Icon name="close" :size="14" /></button>
                  </li>
                </ul>
              </div>
              <div><button type="submit" class="btn btn-primary">{{ L('提交申请', '申請を送信') }}</button></div>
            </form>
          </section>

          <section id="dev-perks" class="vsec" aria-labelledby="dev-perks-h">
            <div class="section-head"><h2 id="dev-perks-h" class="t-h2" tabindex="-1">{{ L('通过后可以', '承認後にできること') }}</h2></div>
            <ul class="perks">
              <li v-for="p in PERKS" :key="p.icon"><Icon :name="p.icon" :size="18" /><span>{{ L(p.zh, p.ja) }}</span></li>
            </ul>
          </section>
        </template>

        <!-- ============ 审核中 ============ -->
        <section v-else-if="status === 'pending'" id="dev-review" class="vsec" aria-labelledby="dev-review-h">
          <div class="section-head">
            <h2 id="dev-review-h" class="t-h2" tabindex="-1">{{ L('申请审核', '申請の審査') }}</h2>
            <span class="tag tag-roll"><Icon name="clock" :size="12" />{{ L('审核中', '審査中') }}</span>
          </div>
          <div class="panel">
            <ol class="stepper" :aria-label="L('审核进度', '審査の進行状況')">
              <li v-for="s in REVIEW_STEPS" :key="s.n" :class="s.state" :aria-current="s.state === 'now' ? 'step' : undefined">
                <i class="note" :class="s.state === 'done' ? 'ka' : s.state === 'now' ? '' : 'ghost'">
                  <Icon v-if="s.state === 'done'" name="check" :size="14" />
                  <span v-else class="num">{{ s.n }}</span>
                </i>
                <span class="lbl">{{ s.label }}</span>
              </li>
            </ol>
            <p class="pending-note">{{ L('结果会发到联系邮箱，通常 3 个工作日内。', '結果は連絡先メールに届きます（通常 3 営業日以内）。') }}</p>
            <dl class="kv pending-kv">
              <dt>{{ L('提交时间', '申請日時') }}</dt>
              <dd class="num">{{ submittedAt }}</dd>
              <dt>{{ L('联系邮箱', '連絡先メール') }}</dt>
              <dd>{{ form.email }}</dd>
              <dt>{{ L('用途', '用途') }}</dt>
              <dd>{{ form.purpose || L('给机厅群做一个查分机器人', 'ゲーセン仲間向けのスコア検索ボット') }}</dd>
            </dl>
            <div class="panel-foot">
              <button type="button" class="btn" @click="withdraw">{{ L('撤回申请', '申請を取り下げる') }}</button>
            </div>
          </div>
        </section>

        <!-- ============ 已通过 ============ -->
        <template v-else>
          <section id="dev-apps" class="vsec" aria-labelledby="dev-apps-h">
            <div class="section-head">
              <h2 id="dev-apps-h" class="t-h2" tabindex="-1">{{ L('已注册应用', '登録済みアプリ') }}</h2>
              <button type="button" class="btn btn-sm" @click="openReg"><Icon name="plus" :size="14" />{{ L('注册应用', 'アプリを登録') }}</button>
            </div>
            <div class="panel scroll-x">
              <table class="dt apps-t">
                <caption class="sr-only">{{ L('已注册的 OIDC 应用', '登録済みの OIDC アプリ') }}</caption>
                <thead>
                  <tr>
                    <th scope="col">{{ L('名称', '名前') }}</th>
                    <th scope="col">Client ID</th>
                    <th scope="col">{{ L('回调地址', 'リダイレクト URI') }}</th>
                    <th scope="col">{{ L('权限', '権限') }}</th>
                    <th scope="col">{{ L('创建时间', '作成日') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="a in apps" :key="a.id">
                    <th scope="row" class="name"><span class="title-1l" :title="a.name">{{ a.name }}</span></th>
                    <td class="num nowrap" :title="a.id">{{ shortId(a.id) }}</td>
                    <td class="uri"><span class="title-1l num" :title="a.uri">{{ a.uri }}</span></td>
                    <td><span class="row-wrap scopes"><span v-for="s in a.scopes" :key="s" class="tag num">{{ s }}</span></span></td>
                    <td class="num nowrap">{{ a.created }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section id="dev-api" class="vsec" aria-labelledby="dev-api-h">
            <div class="section-head">
              <h2 id="dev-api-h" class="t-h2" tabindex="-1">{{ L('接口速查', 'エンドポイント早見表') }}</h2>
              <button type="button" class="more doc" @click="toast(L('原型中未接入文档站', 'プロトタイプでは未接続です'), 'info')">{{ L('完整 API 文档', 'API ドキュメント全文') }}<Icon name="external" :size="14" /></button>
            </div>
            <div class="panel scroll-x">
              <table class="dt eps">
                <caption class="sr-only">{{ L('接口列表', 'エンドポイント一覧') }}</caption>
                <thead class="sr-only">
                  <tr>
                    <th scope="col">{{ L('方法', 'メソッド') }}</th>
                    <th scope="col">{{ L('路径', 'パス') }}</th>
                    <th scope="col">{{ L('说明', '説明') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="e in ENDPOINTS" :key="e.path">
                    <td class="m"><span class="tag tag-info num">GET</span></td>
                    <td class="num path"><span class="base">{{ BASE }}</span>{{ e.path }}</td>
                    <td class="desc">{{ L(e.zh, e.ja) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section id="dev-token" class="vsec" aria-labelledby="dev-token-h">
            <div class="section-head">
              <h2 id="dev-token-h" class="t-h2" tabindex="-1">API token</h2>
              <span v-if="tail" class="tag tag-ok"><Icon name="check" :size="12" />{{ L('有效', '有効') }}</span>
              <span v-else class="tag"><i class="ring" aria-hidden="true" />{{ L('没有 token', 'トークンなし') }}</span>
            </div>
            <div class="panel panel-pad col token-box">
              <template v-if="tail">
                <code class="num token">{{ masked }}</code>
                <p class="t-small">{{ L('最近使用', '最終利用') }} <span class="num">2026-11-16 19:52</span></p>
                <div class="row-wrap">
                  <button type="button" class="btn btn-sm" @click="copyToken"><Icon name="copy" :size="14" />{{ L('复制', 'コピー') }}</button>
                </div>
              </template>
              <template v-else>
                <p class="t-small">{{ L('没有可用的 token。', '有効なトークンはありません。') }}</p>
                <div><button type="button" class="btn" @click="generate"><Icon name="key" :size="16" />{{ L('生成 token', 'トークンを発行') }}</button></div>
              </template>
            </div>
            <div v-if="tail" class="danger-zone">
              <button type="button" class="btn btn-ghost quiet-danger" @click="confirmKind = 'regen'">{{ L('重新生成…', '再発行…') }}</button>
              <button type="button" class="btn btn-ghost quiet-danger" @click="confirmKind = 'revoke'">{{ L('吊销 token…', 'トークンを失効…') }}</button>
            </div>
          </section>

          <section id="dev-oidc" class="vsec" aria-labelledby="dev-oidc-h">
            <div class="section-head"><h2 id="dev-oidc-h" class="t-h2" tabindex="-1">{{ L('Viewer 作为 OIDC Provider', 'OIDC プロバイダーとしての Viewer') }}</h2></div>
            <dl class="panel oidc">
              <div>
                <dt>Issuer</dt>
                <dd class="num">https://viewer.sakura-bot.cn/oidc</dd>
              </div>
              <div>
                <dt>{{ L('已接入的客户端', '接続中のクライアント') }}</dt>
                <dd>OurTaiko</dd>
              </div>
            </dl>
          </section>
        </template>
      </div>
    </div>

    <!-- 注册应用 -->
    <Sheet :open="regOpen" :title="L('注册应用', 'アプリを登録')" @close="regOpen = false">
      <form class="col form" novalidate @submit.prevent="saveReg">
        <div class="field">
          <label for="reg-name">{{ L('应用名称', 'アプリ名') }}</label>
          <input id="reg-name" v-model="reg.name" class="input" :class="{ 'is-error': reg.errors.name }" maxlength="32" autocomplete="off" enterkeyhint="next" :aria-invalid="!!reg.errors.name" :aria-describedby="reg.errors.name ? 'reg-name-err' : undefined" />
          <span v-if="reg.errors.name" id="reg-name-err" class="field-error" role="alert">{{ reg.errors.name }}</span>
        </div>
        <div class="field">
          <label for="reg-uri">{{ L('回调地址', 'リダイレクト URI') }}</label>
          <input id="reg-uri" v-model="reg.uri" type="url" inputmode="url" autocomplete="off" enterkeyhint="done" class="input num" :class="{ 'is-error': reg.errors.uri }" placeholder="https://example.com/callback" :aria-invalid="!!reg.errors.uri" :aria-describedby="reg.errors.uri ? 'reg-uri-err' : undefined" />
          <span v-if="reg.errors.uri" id="reg-uri-err" class="field-error" role="alert">{{ reg.errors.uri }}</span>
        </div>
        <fieldset class="field scope-set" :aria-describedby="reg.errors.scopes ? 'reg-scope-err' : undefined">
          <legend class="field-label">{{ L('权限', '権限') }}</legend>
          <label v-for="s in SCOPES" :key="s" class="scope">
            <input v-model="reg.scopes" type="checkbox" :value="s" />
            <span class="num">{{ s }}</span>
          </label>
          <span v-if="reg.errors.scopes" id="reg-scope-err" class="field-error" role="alert">{{ reg.errors.scopes }}</span>
        </fieldset>
      </form>
      <template #foot>
        <button type="button" class="btn" @click="regOpen = false">{{ L('取消', 'キャンセル') }}</button>
        <button type="button" class="btn btn-primary" @click="saveReg">{{ L('注册应用', 'アプリを登録') }}</button>
      </template>
    </Sheet>

    <!-- token 确认 -->
    <Sheet :open="!!confirmKind" :title="confirmKind === 'revoke' ? L('吊销 token', 'トークンを失効') : L('重新生成 token', 'トークンを再発行')" :width="440" @close="confirmKind = ''">
      <p class="consequence">
        {{
          confirmKind === 'revoke'
            ? L('吊销后，正在使用这个 token 的程序会立即无法访问 API。', '失効させると、このトークンを使っているプログラムはすぐに API を使えなくなります。')
            : L('生成新 token 后旧 token 立即失效，需要把新 token 更新到你的程序里。', '再発行すると古いトークンはすぐに無効になります。プログラム側の設定を更新してください。')
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
/* ---------- 单栏 760 + 宽屏页内目录（V10） ---------- */
.vpage {
  max-width: 760px;
  margin: 0 auto;
}
.vcol {
  display: flex;
  flex-direction: column;
  gap: var(--sp-10);
  min-width: 0;
}
.toc {
  display: none;
}
.vsec {
  min-width: 0;
  scroll-margin-top: calc(var(--bar-h) + 24px);
}
.vsec h2:focus-visible {
  box-shadow: none;
  text-decoration: underline;
}
@media (min-width: 1100px) {
  .vpage {
    display: grid;
    grid-template-columns: 200px minmax(0, 760px);
    gap: var(--sp-10);
    max-width: calc(200px + 760px + var(--sp-10));
  }
  .toc {
    display: block;
    position: sticky;
    top: calc(var(--bar-h) + 24px);
    align-self: start;
  }
}
.toc ul {
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-left: 1px solid var(--line);
}
.toc button {
  display: block;
  width: 100%;
  min-height: 36px;
  margin-left: -1px;
  padding: 6px 12px;
  border-left: 2px solid transparent;
  text-align: left;
  font-size: var(--fs-14);
  color: var(--ink-2);
}
.toc button:hover {
  color: var(--ink);
}
.toc button[aria-current='true'] {
  border-left-color: var(--selected-line);
  color: var(--ink);
  font-weight: 700;
}

.demo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
  border: 1px dashed var(--line-strong);
  border-radius: var(--r-ctl);
}
.demo .t-small {
  color: var(--ink-2);
}
.form {
  gap: var(--sp-5);
}
.ring {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1.5px currentColor;
  flex: none;
}

/* 未申请 */
.drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: var(--sp-5);
  border: 1.5px dashed var(--ctl-border);
  border-radius: var(--r-ctl);
  background: var(--surface-2);
  color: var(--ink-2);
  transition: border-color var(--dur-1), color var(--dur-1);
}
.drop:hover {
  border-color: var(--ink-2);
  color: var(--ink);
}
.drop[disabled] {
  cursor: default;
  color: var(--ink-3);
}
.shots {
  gap: 8px;
}
.chip {
  padding-right: 4px;
}
.x {
  display: inline-grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  color: var(--ink-2);
}
.x:hover {
  background: var(--bg-sunk);
  color: var(--ink);
}
.perks {
  border-top: 1px solid var(--line-strong);
}
.perks li {
  display: flex;
  gap: var(--sp-3);
  padding: var(--sp-3) 0;
  border-bottom: 1px solid var(--line);
  font-size: var(--fs-16);
  color: var(--ink-2);
}
.perks li span {
  color: var(--ink);
}

/* 审核中：步骤器 */
.stepper {
  display: flex;
  padding: var(--sp-5) var(--sp-4) var(--sp-4);
}
.stepper li {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
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
  background: var(--progress-line);
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
.stepper li.now {
  color: var(--ink);
  font-weight: 700;
}
.pending-note {
  padding: 0 var(--sp-5) var(--sp-4);
  font-size: var(--fs-14);
  text-align: center;
  color: var(--ink-2);
}
.pending-kv {
  padding: var(--sp-4) var(--sp-5);
  gap: 10px 24px;
  border-top: 1px solid var(--line);
  font-size: var(--fs-14);
}
.pending-kv dd {
  text-align: left;
  overflow-wrap: anywhere;
}
.panel-foot {
  padding: var(--sp-3) var(--sp-5) var(--sp-4);
  border-top: 1px solid var(--line);
}

/* 已通过 */
.panel.scroll-x {
  overscroll-behavior-x: contain;
}
.apps-t {
  min-width: 640px;
}
.apps-t th[scope='row'] {
  max-width: 180px;
  text-align: left;
  font-weight: 700;
}
.nowrap {
  white-space: nowrap;
}
.scopes {
  gap: 4px;
}
.uri {
  max-width: 220px;
}
.uri .title-1l {
  color: var(--ink-2);
}
.doc {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 32px;
}
.eps {
  min-width: 560px;
}
.eps .m {
  width: 1%;
}
.eps .path {
  font-size: var(--fs-14);
  white-space: nowrap;
}
.eps .base {
  color: var(--ink-3);
}
.eps .desc {
  color: var(--ink-2);
}
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
.oidc > div {
  padding: var(--sp-3) var(--sp-5);
  border-bottom: 1px solid var(--line);
}
.oidc > div:last-child {
  border-bottom: 0;
}
.oidc dt {
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.oidc dd {
  font-weight: 500;
  overflow-wrap: anywhere;
}
.oidc .num {
  font-size: var(--fs-14);
}

/* 注册应用 */
.scope-set {
  margin: 0;
  padding: 0;
  border: 0;
  gap: 0;
}
.scope-set legend {
  padding: 0;
  margin-bottom: 4px;
}
.scope {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  min-height: 40px;
  border-bottom: 1px solid var(--line);
  font-size: var(--fs-14);
  cursor: pointer;
}
.scope input {
  width: 18px;
  height: 18px;
  accent-color: var(--ink);
}

@media (max-width: 767px) {
  .vcol {
    gap: var(--sp-8);
  }
  .demo .seg {
    width: 100%;
  }
  .demo .seg button {
    flex: 1;
  }
  .stepper {
    padding: var(--sp-4) var(--sp-2) var(--sp-3);
  }
  .pending-kv {
    padding: var(--sp-4);
  }
  .panel-foot .btn,
  .danger-zone .btn {
    width: 100%;
  }
  .scope {
    min-height: 44px;
  }
  .shots {
    gap: 10px;
  }
}
</style>
