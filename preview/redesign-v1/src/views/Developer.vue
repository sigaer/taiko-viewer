<script setup>
import { computed, reactive, ref } from 'vue'
import Icon from '../components/Icon.vue'
import Sheet from '../components/Sheet.vue'
import EmptyLane from '../components/EmptyLane.vue'
import { store, L, toast } from '../store'

/* ---------- 申请状态 ---------- */
const STATES = [
  { v: 'none', zh: '未申请', ja: '未申請' },
  { v: 'pending', zh: '审核中', ja: '審査中' },
  { v: 'approved', zh: '已通过', ja: '承認済み' },
]
const status = ref('none')
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
  if (Object.keys(form.errors).length) return
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
function regen() {
  tail.value = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0')
  toast(L('已生成新的 token，旧 token 立即失效', '新しいトークンを発行しました。古いトークンは無効です'))
}
function revoke() {
  tail.value = ''
  toast(L('token 已吊销', 'トークンを失効させました'))
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
</script>

<template>
  <div class="page dev">
    <EmptyLane v-if="store.auth === 'guest'" :title="L('登录后管理账号', 'ログインしてアカウントを管理')">
      <RouterLink to="/login" class="btn btn-primary">{{ L('登录', 'ログイン') }}</RouterLink>
    </EmptyLane>

    <template v-else>
      <div class="demo">
        <span class="t-caption">{{ L('申请状态', '申請ステータス') }}</span>
        <div class="seg" role="group" :aria-label="L('申请状态', '申請ステータス')">
          <button v-for="s in STATES" :key="s.v" :aria-pressed="status === s.v" @click="status = s.v">{{ L(s.zh, s.ja) }}</button>
        </div>
      </div>

      <!-- ============ 未申请 ============ -->
      <div v-if="status === 'none'" class="cols">
        <section class="main">
          <div class="section-head"><h2 class="t-h2">{{ L('申请开发者权限', '開発者権限を申請') }}</h2></div>
          <form class="panel panel-pad col form" novalidate @submit.prevent="submit">
            <div class="field">
              <label for="dev-purpose">{{ L('用途', '用途') }}</label>
              <textarea id="dev-purpose" v-model="form.purpose" class="textarea" rows="4" :placeholder="L('例如：给机厅群做一个查分机器人', '例：ゲーセン仲間向けのスコア検索ボット')" />
              <span v-if="form.errors.purpose" class="field-error">{{ form.errors.purpose }}</span>
            </div>
            <div class="field">
              <label for="dev-email">{{ L('联系邮箱', '連絡先メール') }}</label>
              <input id="dev-email" v-model="form.email" type="email" class="input" :class="{ 'is-error': form.errors.email }" />
              <span v-if="form.errors.email" class="field-error">{{ form.errors.email }}</span>
            </div>
            <div class="field">
              <span class="field-label">{{ L('截图', 'スクリーンショット') }}</span>
              <button type="button" class="drop" :disabled="form.shots.length >= 3" @click="addShot">
                <Icon name="upload" :size="22" />
                <b>{{ L('添加截图', 'スクリーンショットを追加') }}</b>
                <span class="field-hint">{{ L('项目页面或原型，最多 3 张', 'プロジェクト画面や試作、3 枚まで') }}</span>
              </button>
              <ul v-if="form.shots.length" class="row-wrap">
                <li v-for="(f, i) in form.shots" :key="f" class="chip">
                  <span class="num">{{ f }}</span>
                  <button type="button" class="x" :aria-label="L('移除', '削除')" @click="form.shots.splice(i, 1)"><Icon name="close" :size="14" /></button>
                </li>
              </ul>
            </div>
            <div><button type="submit" class="btn btn-primary">{{ L('提交申请', '申請を送信') }}</button></div>
          </form>
        </section>
        <aside class="side">
          <div class="section-head"><h2 class="t-h2">{{ L('通过后可以', '承認後にできること') }}</h2></div>
          <ul class="perks">
            <li v-for="p in PERKS" :key="p.icon"><Icon :name="p.icon" :size="18" /><span>{{ L(p.zh, p.ja) }}</span></li>
          </ul>
        </aside>
      </div>

      <!-- ============ 审核中 ============ -->
      <section v-else-if="status === 'pending'" class="panel pending">
        <div class="pending-top">
          <i class="note big roll" />
          <div class="grow">
            <h2 class="t-h2">{{ L('申请审核中', '申請を審査中') }}</h2>
            <p class="t-small">{{ L('结果会发到联系邮箱，通常 3 个工作日内。', '結果は連絡先メールに届きます（通常 3 営業日以内）。') }}</p>
          </div>
          <button class="btn" @click="withdraw">{{ L('撤回申请', '申請を取り下げる') }}</button>
        </div>
        <dl class="kv pending-kv">
          <dt>{{ L('提交时间', '申請日時') }}</dt>
          <dd class="num">{{ submittedAt }}</dd>
          <dt>{{ L('联系邮箱', '連絡先メール') }}</dt>
          <dd>{{ form.email }}</dd>
          <dt>{{ L('用途', '用途') }}</dt>
          <dd>{{ form.purpose || L('给机厅群做一个查分机器人', 'ゲーセン仲間向けのスコア検索ボット') }}</dd>
        </dl>
      </section>

      <!-- ============ 已通过 ============ -->
      <div v-else class="cols">
        <div class="main">
          <section>
            <div class="section-head">
              <h2 class="t-h2">{{ L('已注册应用', '登録済みアプリ') }}</h2>
              <button class="btn btn-sm" @click="openReg"><Icon name="plus" :size="14" />{{ L('注册应用', 'アプリを登録') }}</button>
            </div>
            <div class="panel">
              <div class="only-desktop scroll-x">
                <table class="dt">
                  <thead>
                    <tr>
                      <th>Client ID</th>
                      <th>{{ L('名称', '名前') }}</th>
                      <th>{{ L('回调地址', 'リダイレクト URI') }}</th>
                      <th>{{ L('权限', '権限') }}</th>
                      <th>{{ L('创建时间', '作成日') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="a in apps" :key="a.id">
                      <td class="num" :title="a.id">{{ shortId(a.id) }}</td>
                      <td><b>{{ a.name }}</b></td>
                      <td class="uri"><span class="truncate num">{{ a.uri }}</span></td>
                      <td><span class="row-wrap scopes"><span v-for="s in a.scopes" :key="s" class="tag num">{{ s }}</span></span></td>
                      <td class="num">{{ a.created }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <ul class="only-mobile rows">
                <li v-for="a in apps" :key="a.id" class="app">
                  <div class="spread"><b>{{ a.name }}</b><span class="num faint">{{ shortId(a.id) }}</span></div>
                  <span class="num t-small uri-m">{{ a.uri }}</span>
                  <span class="row-wrap scopes"><span v-for="s in a.scopes" :key="s" class="tag num">{{ s }}</span></span>
                  <span class="t-caption">{{ L('创建于', '作成日') }} <span class="num">{{ a.created }}</span></span>
                </li>
              </ul>
            </div>
          </section>

          <section class="section">
            <div class="section-head">
              <h2 class="t-h2">{{ L('接口速查', 'エンドポイント早見表') }}</h2>
              <button type="button" class="more doc" @click="toast(L('原型中未接入文档站', 'プロトタイプでは未接続です'), 'info')">{{ L('完整 API 文档', 'API ドキュメント全文') }}<Icon name="external" :size="14" /></button>
            </div>
            <div class="panel scroll-x">
              <table class="dt eps">
                <tbody>
                  <tr v-for="e in ENDPOINTS" :key="e.path">
                    <td class="m"><span class="tag tag-ka num">GET</span></td>
                    <td class="num path"><span class="faint">{{ BASE }}</span>{{ e.path }}</td>
                    <td class="desc">{{ L(e.zh, e.ja) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside class="side">
          <section>
            <div class="section-head"><h2 class="t-h2">API token</h2></div>
            <div class="panel panel-pad col">
              <template v-if="tail">
                <code class="num token">{{ masked }}</code>
                <p class="t-caption">{{ L('最近使用', '最終利用') }} <span class="num">2026-11-16 19:52</span></p>
                <div class="row-wrap">
                  <button class="btn btn-sm" @click="copyToken"><Icon name="copy" :size="14" />{{ L('复制', 'コピー') }}</button>
                  <button class="btn btn-sm" @click="regen">{{ L('重新生成', '再発行') }}</button>
                  <button class="btn btn-sm btn-ghost" @click="revoke">{{ L('吊销', '失効させる') }}</button>
                </div>
              </template>
              <template v-else>
                <p class="t-small">{{ L('没有可用的 token。', '有効なトークンはありません。') }}</p>
                <button class="btn" @click="regen"><Icon name="key" :size="16" />{{ L('生成 token', 'トークンを発行') }}</button>
              </template>
            </div>
          </section>

          <section class="section">
            <div class="section-head"><h2 class="t-h2">{{ L('Viewer 作为 OIDC Provider', 'OIDC プロバイダーとしての Viewer') }}</h2></div>
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
        </aside>
      </div>
    </template>

    <!-- 注册应用 -->
    <Sheet :open="regOpen" :title="L('注册应用', 'アプリを登録')" @close="regOpen = false">
      <form class="col form" novalidate @submit.prevent="saveReg">
        <div class="field">
          <label for="reg-name">{{ L('应用名称', 'アプリ名') }}</label>
          <input id="reg-name" v-model="reg.name" class="input" :class="{ 'is-error': reg.errors.name }" maxlength="32" />
          <span v-if="reg.errors.name" class="field-error">{{ reg.errors.name }}</span>
        </div>
        <div class="field">
          <label for="reg-uri">{{ L('回调地址', 'リダイレクト URI') }}</label>
          <input id="reg-uri" v-model="reg.uri" class="input num" :class="{ 'is-error': reg.errors.uri }" placeholder="https://example.com/callback" />
          <span v-if="reg.errors.uri" class="field-error">{{ reg.errors.uri }}</span>
        </div>
        <fieldset class="field scope-set">
          <legend class="field-label">{{ L('权限', '権限') }}</legend>
          <label v-for="s in SCOPES" :key="s" class="scope">
            <input v-model="reg.scopes" type="checkbox" :value="s" />
            <span class="num">{{ s }}</span>
          </label>
          <span v-if="reg.errors.scopes" class="field-error">{{ reg.errors.scopes }}</span>
        </fieldset>
      </form>
      <template #foot>
        <button class="btn" @click="regOpen = false">{{ L('取消', 'キャンセル') }}</button>
        <button class="btn btn-primary" @click="saveReg">{{ L('注册应用', 'アプリを登録') }}</button>
      </template>
    </Sheet>
  </div>
</template>

<style scoped>
.demo {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--sp-3);
  margin-bottom: var(--sp-5);
}
.cols {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  align-items: start;
  gap: var(--sp-8);
}
.main,
.side {
  min-width: 0;
}
.form {
  gap: var(--sp-5);
}
.rows > li {
  border-bottom: 1px solid var(--line);
}
.rows > li:last-child {
  border-bottom: 0;
}

/* 未申请 */
.drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: var(--sp-5);
  border: 1.5px dashed var(--line-strong);
  border-radius: var(--r-ctl);
  background: var(--surface-2);
  color: var(--ink-2);
  transition: border-color var(--dur-1), color var(--dur-1);
}
.drop:hover {
  border-color: var(--ka);
  color: var(--ink);
}
.drop[disabled] {
  opacity: 0.5;
  cursor: default;
}
.chip {
  padding-right: 4px;
}
.x {
  display: inline-grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  color: var(--ink-3);
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
  color: var(--ink-2);
}
.perks li span {
  color: var(--ink);
}

/* 审核中 */
.pending {
  max-width: 760px;
}
.pending-top {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  padding: var(--sp-5);
  border-bottom: 1px solid var(--line);
}
.pending-top .note {
  --n: 28px;
}
.pending-kv {
  padding: var(--sp-5);
  gap: 10px 24px;
}
.pending-kv dd {
  text-align: left;
  overflow-wrap: anywhere;
}

/* 已通过 */
.panel > .scroll-x {
  border-radius: inherit;
}
.scopes {
  gap: 4px;
}
.uri {
  max-width: 240px;
}
.uri .truncate {
  display: block;
  color: var(--ink-2);
}
.app {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: var(--sp-4);
}
.uri-m {
  overflow-wrap: anywhere;
}
.doc {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.eps .m {
  width: 1%;
}
.eps .path {
  font-size: var(--fs-14);
  white-space: nowrap;
}
.eps .desc {
  color: var(--ink-2);
}
.token {
  display: block;
  padding: 10px 12px;
  border-radius: var(--r-ctl);
  background: var(--bg-sunk);
  font-size: var(--fs-16);
  overflow-wrap: anywhere;
}
.oidc > div {
  padding: var(--sp-3) var(--sp-5);
  border-bottom: 1px solid var(--line);
}
.oidc > div:last-child {
  border-bottom: 0;
}
.oidc dt {
  font-size: var(--fs-12);
  color: var(--ink-3);
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
  accent-color: var(--don);
}

@media (max-width: 1099px) {
  .cols {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--sp-10);
  }
}
@media (max-width: 767px) {
  .demo {
    justify-content: space-between;
  }
  .cols {
    gap: var(--sp-8);
  }
  .pending-top {
    flex-wrap: wrap;
    padding: var(--sp-4);
  }
  .pending-top .btn {
    width: 100%;
  }
  .pending-kv {
    padding: var(--sp-4);
  }
  .eps .path {
    white-space: normal;
    overflow-wrap: anywhere;
  }
  .scope {
    min-height: 44px;
  }
  .x {
    width: 34px;
    height: 34px;
  }
}
</style>
