<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Icon from '../components/Icon.vue'
import Sheet from '../components/Sheet.vue'
import EmptyLane from '../components/EmptyLane.vue'
import PlayerAvatar from '../components/PlayerAvatar.vue'
import TitlePlate from '../components/TitlePlate.vue'
import DanBadge from '../components/DanBadge.vue'
import { player, devApps, users } from '../mock/data'
import { store, L, toast } from '../store'
import { sync } from '../sync'
import { useSectionNav } from '../sectionNav'

const router = useRouter()
const EMAIL = 'mochi.don@example.com'
const TODAY = '2026-11-16'
const HUE = users?.mochidon?.hue ?? 12

/* ---------- 资料 ---------- */
const nickname = ref(player.nickname)
const editOpen = ref(false)
const draft = reactive({ nickname: '', file: '', error: '' })
function openEdit() {
  draft.nickname = nickname.value
  draft.file = ''
  draft.error = ''
  editOpen.value = true
}
function saveProfile() {
  const v = draft.nickname.trim()
  if (v.length < 2 || v.length > 16) {
    draft.error = L('昵称需要 2 到 16 个字，调整后再保存。', 'ニックネームは 2〜16 文字で入力してください。')
    return
  }
  nickname.value = v
  editOpen.value = false
  toast(L('资料已保存', 'プロフィールを保存しました'))
}

/* ---------- 游戏账号 ---------- */
const SOURCES = {
  wahlap: { zh: '鼓众广场', ja: '鼓衆広場' },
  hiroba: { zh: 'Donder Hiroba', ja: 'ドンだーひろば' },
  manual: { zh: '手动成绩', ja: '手動記録' },
}
const seed = () => (store.auth === 'unbound' ? [] : player.bindings.map((b) => ({ ...b })))
const bindings = ref(seed())
watch(
  () => store.auth,
  () => (bindings.value = seed()),
)
const stamp = (b) => (b.source === 'manual' ? L('手动', '手動') : b.region)
const lastSync = computed(() => L(sync.lastSyncLabel.zh, sync.lastSyncLabel.ja))
function setCurrent(b) {
  bindings.value.forEach((x) => (x.current = x.id === b.id))
  toast(L(`已切换到「${b.name}」`, `「${b.name}」に切り替えました`))
}

const addOpen = ref(false)
const claim = reactive({ code: '', error: '' })
const qqSent = ref(false)
function openAdd() {
  claim.code = ''
  claim.error = ''
  qqSent.value = false
  addOpen.value = true
}
function addManual(name, taikoId) {
  const id = Math.max(0, ...bindings.value.map((b) => b.id)) + 1
  bindings.value.push({ id, source: 'manual', region: '手动', taikoId, name, current: bindings.value.length === 0, title: '—', sync: false })
  addOpen.value = false
}
function createManual() {
  addManual(L('新的手动账号', '新しい手動アカウント'), '—')
  toast(L('已创建手动成绩账号', '手動記録アカウントを作成しました'))
}
function claimManual() {
  if (!/^[A-Za-z0-9]{8}$/.test(claim.code.trim())) {
    claim.error = L('认领码是 8 位字母或数字，核对后再输入一次。', '引き継ぎコードは 8 桁の英数字です。確認してもう一度入力してください。')
    return
  }
  addManual(L('认领的账号', '引き継いだアカウント'), '55••••••••••0718')
  toast(L('认领成功，账号已加入列表', '引き継ぎが完了しました'))
}
function sendQqCode() {
  qqSent.value = true
  toast(L('验证码已发送到你的邮箱', '確認コードをメールで送信しました'))
}

/* ---------- 登录方式 ---------- */
const oidcLinked = ref(true)
const qqBound = ref(false)
function linkOidc() {
  oidcLinked.value = true
  toast(L('已关联 OurTaiko', 'OurTaiko と連携しました'))
}
function bindQq() {
  qqBound.value = true
  toast(L('QQ 已绑定', 'QQ を連携しました'))
}
const pwOpen = ref(false)
const pw = reactive({ cur: '', next: '', again: '', error: '' })
function openPw() {
  Object.assign(pw, { cur: '', next: '', again: '', error: '' })
  pwOpen.value = true
}
function savePw() {
  if (!pw.cur) pw.error = L('请输入当前密码。', '現在のパスワードを入力してください。')
  else if (pw.next.length < 8) pw.error = L('新密码至少 8 位，加长后再试。', '新しいパスワードは 8 文字以上にしてください。')
  else if (pw.next !== pw.again) pw.error = L('两次输入的新密码不一致，请重新输入。', '新しいパスワードが一致しません。もう一度入力してください。')
  else {
    pwOpen.value = false
    toast(L('密码已修改', 'パスワードを変更しました'))
  }
}

/* ---------- 称号展示 ---------- */
const TITLES = [
  { text: player.title, rare: false },
  { text: '太鼓好き', rare: false },
  { text: '九段合格', rare: false },
  { text: '全良收藏家', rare: true },
  { text: '节奏旅人', rare: false },
]
const shownTitle = ref(player.title)
const shownRare = computed(() => !!TITLES.find((t) => t.text === shownTitle.value)?.rare)
function onTitle() {
  toast(L(`展示称号已换成「${shownTitle.value}」`, `表示する称号を「${shownTitle.value}」に変更しました`))
}

/* ---------- 第三方应用 ---------- */
const apps = ref(devApps.map((a) => ({ ...a })))
const expired = (a) => a.expires < TODAY

/* ---------- 破坏性操作：一律在确认弹层里说明后果 ---------- */
const confirm = reactive({ open: false, kind: '', pick: null })
const CONFIRM = {
  unbind: {
    title: () => L('解除绑定', '連携を解除'),
    options: () => bindings.value.map((b) => ({ v: b.id, label: `${stamp(b)} · ${b.name}` })),
    item: (v) => bindings.value.find((b) => b.id === v),
    consequence: (b) =>
      b.source === 'manual'
        ? L(`删除后，「${b.name}」里的手动成绩会一起删除，无法恢复。`, `削除すると「${b.name}」の手動記録もすべて削除され、元に戻せません。`)
        : L(`解除后，「${b.name}」的成绩不再出现在成绩和成长记录里；重新绑定可以恢复。`, `解除すると「${b.name}」のスコアは成績と成長記録に表示されなくなります。再連携で元に戻せます。`),
    action: (b) => (b.source === 'manual' ? L('删除手动账号', '手動アカウントを削除') : L('解除绑定', '連携を解除')),
    run(b) {
      bindings.value = bindings.value.filter((x) => x.id !== b.id)
      if (b.current && bindings.value.length) bindings.value[0].current = true
      toast(b.source === 'manual' ? L(`已删除「${b.name}」`, `「${b.name}」を削除しました`) : L(`已解除「${b.name}」的绑定`, `「${b.name}」の連携を解除しました`))
    },
  },
  login: {
    title: () => L('解除登录方式', 'ログイン方法の解除'),
    options: () => [oidcLinked.value && { v: 'oidc', label: 'OurTaiko' }, qqBound.value && { v: 'qq', label: 'QQ' }].filter(Boolean),
    item: (v) => v,
    consequence: (v) =>
      v === 'oidc'
        ? L('解除后不能再用 OurTaiko 登录，OurTaiko 也不再收到同步推送。', '解除すると OurTaiko でログインできなくなり、OurTaiko への同期も止まります。')
        : L('解绑后不能再用 QQ 登录。', '解除すると QQ でログインできなくなります。'),
    action: (v) => (v === 'oidc' ? L('解除 OurTaiko 关联', 'OurTaiko の連携を解除') : L('解绑 QQ', 'QQ の連携を解除')),
    run(v) {
      if (v === 'oidc') oidcLinked.value = false
      else qqBound.value = false
      toast(v === 'oidc' ? L('已解除 OurTaiko 关联', 'OurTaiko の連携を解除しました') : L('QQ 已解绑', 'QQ の連携を解除しました'))
    },
  },
  revoke: {
    title: () => L('撤销授权', '許可の取り消し'),
    options: () => apps.value.map((a) => ({ v: a.name, label: a.name })),
    item: (v) => apps.value.find((a) => a.name === v),
    consequence: (a) => L(`撤销后，${a.name} 不能再读取你的数据；要恢复需要在该应用里重新授权。`, `取り消すと ${a.name} はデータを読み取れなくなります。再度使うにはアプリ側で許可し直してください。`),
    action: () => L('撤销授权', '許可を取り消す'),
    run(a) {
      apps.value = apps.value.filter((x) => x.name !== a.name)
      toast(L(`已撤销 ${a.name} 的授权`, `${a.name} の許可を取り消しました`))
    },
  },
}
const cfg = computed(() => CONFIRM[confirm.kind] || null)
const cfgOptions = computed(() => (cfg.value ? cfg.value.options() : []))
const cfgItem = computed(() => (cfg.value && confirm.pick != null ? cfg.value.item(confirm.pick) : null))
function openConfirm(kind, pick = null) {
  const opts = CONFIRM[kind].options()
  if (!opts.length) return
  confirm.kind = kind
  confirm.pick = pick ?? opts[0].v
  confirm.open = true
}
function runConfirm() {
  const item = cfgItem.value
  if (item != null) cfg.value.run(item)
  confirm.open = false
}

function logout() {
  store.auth = 'guest'
  router.push('/')
}

/* ---------- 页内目录（≥ 1100px 显示） ---------- */
const NAV = computed(() => [
  { id: 'acc-bind', label: L('游戏账号', 'ゲームアカウント') },
  { id: 'acc-login', label: L('登录方式', 'ログイン方法') },
  { id: 'acc-title', label: L('称号展示', '称号の表示') },
  { id: 'acc-apps', label: L('第三方应用', '連携アプリ') },
  { id: 'acc-out', label: L('退出登录', 'ログアウト') },
])
const { current: currentSec, scrollTo } = useSectionNav(() => NAV.value.map((n) => n.id), { deps: [() => store.auth] })
</script>

<template>
  <div class="page account">
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
        <!-- 身份 -->
        <header class="ident">
          <PlayerAvatar :name="nickname" :hue="HUE" :dan="player.dan" :size="72" />
          <div class="grow ident-main">
            <h2 class="ident-name title-wrap-2">{{ nickname }}</h2>
            <p class="row-wrap ident-plates">
              <TitlePlate :text="shownTitle" :rare="shownRare" />
              <DanBadge :dan="player.dan" />
            </p>
            <p class="ident-meta">
              <span class="num">@{{ player.username }}</span>
              <span class="mail">
                <span class="truncate">{{ EMAIL }}</span>
                <span class="tag tag-ok"><Icon name="check" :size="12" />{{ L('已验证', '確認済み') }}</span>
              </span>
              <span><span class="num">{{ player.joined }}</span> {{ L('加入', '登録') }}</span>
            </p>
          </div>
          <button type="button" class="btn" @click="openEdit"><Icon name="edit" :size="16" />{{ L('编辑资料', 'プロフィールを編集') }}</button>
        </header>

        <!-- 游戏账号 -->
        <section id="acc-bind" class="vsec" aria-labelledby="acc-bind-h">
          <div class="section-head">
            <h2 id="acc-bind-h" class="t-h2" tabindex="-1">{{ L('游戏账号', 'ゲームアカウント') }}</h2>
            <span v-if="bindings.length" class="t-small"><span class="num">{{ bindings.length }}</span> {{ L('个', '件') }}</span>
          </div>
          <div class="panel">
            <ul v-if="bindings.length" class="rows">
              <li v-for="b in bindings" :key="b.id" class="srow">
                <span class="tag region">{{ stamp(b) }}</span>
                <div class="grow">
                  <p class="srow-name">
                    <b class="title-1l" :title="b.name">{{ b.name }}</b>
                    <span v-if="b.current" class="tag tag-info"><Icon name="check" :size="12" />{{ L('当前', '使用中') }}</span>
                  </p>
                  <p class="srow-sub">
                    <span class="num">{{ b.taikoId }}</span>
                    <span>{{ L(SOURCES[b.source].zh, SOURCES[b.source].ja) }}</span>
                    <span v-if="b.current && b.source !== 'manual'">{{ L(`上次同步：${lastSync}`, `前回の同期：${lastSync}`) }}</span>
                  </p>
                </div>
                <RouterLink v-if="b.current" to="/account/sync" class="btn btn-sm">{{ L('同步设置', '同期設定') }}</RouterLink>
                <button v-else type="button" class="btn btn-sm" @click="setCurrent(b)">{{ L('设为当前', '使用中にする') }}</button>
              </li>
            </ul>
            <EmptyLane v-else compact :title="L('还没有绑定游戏账号', 'ゲームアカウントが未連携です')">
              <RouterLink to="/bind" class="btn btn-primary">{{ L('绑定鼓众广场 ID', '鼓衆広場 ID を連携') }}</RouterLink>
            </EmptyLane>
            <div class="panel-foot">
              <button type="button" class="btn" @click="openAdd"><Icon name="plus" :size="16" />{{ L('添加账号', 'アカウントを追加') }}</button>
            </div>
          </div>
          <div v-if="bindings.length" class="danger-zone">
            <button type="button" class="btn btn-ghost quiet-danger" @click="openConfirm('unbind')">{{ L('解除绑定或删除手动账号…', '連携解除・手動アカウント削除…') }}</button>
          </div>
        </section>

        <!-- 登录方式 -->
        <section id="acc-login" class="vsec" aria-labelledby="acc-login-h">
          <div class="section-head"><h2 id="acc-login-h" class="t-h2" tabindex="-1">{{ L('登录方式', 'ログイン方法') }}</h2></div>
          <ul class="panel rows">
            <li class="srow">
              <Icon name="mail" />
              <div class="grow">
                <b>{{ L('邮箱与密码', 'メールとパスワード') }}</b>
                <span class="srow-sub title-1l" :title="EMAIL">{{ EMAIL }}</span>
              </div>
              <span class="tag tag-ok"><Icon name="check" :size="12" />{{ L('已验证', '確認済み') }}</span>
              <button type="button" class="btn btn-sm" @click="openPw">{{ L('修改密码', 'パスワードを変更') }}</button>
            </li>
            <li class="srow">
              <Icon name="link" />
              <div class="grow">
                <b>OurTaiko</b>
                <span class="srow-sub">OIDC</span>
              </div>
              <span v-if="oidcLinked" class="tag tag-ok"><Icon name="check" :size="12" />{{ L('已关联', '連携済み') }}</span>
              <template v-else>
                <span class="tag"><i class="ring" aria-hidden="true" />{{ L('未关联', '未連携') }}</span>
                <button type="button" class="btn btn-sm" @click="linkOidc">{{ L('关联', '連携する') }}</button>
              </template>
            </li>
            <li class="srow">
              <Icon name="community" />
              <div class="grow">
                <b>QQ</b>
                <span v-if="qqBound" class="srow-sub num">2841••••07</span>
              </div>
              <span v-if="qqBound" class="tag tag-ok"><Icon name="check" :size="12" />{{ L('已绑定', '連携済み') }}</span>
              <template v-else>
                <span class="tag"><i class="ring" aria-hidden="true" />{{ L('未绑定', '未連携') }}</span>
                <button type="button" class="btn btn-sm" @click="bindQq">{{ L('绑定', '連携する') }}</button>
              </template>
            </li>
          </ul>
          <div v-if="oidcLinked || qqBound" class="danger-zone">
            <button type="button" class="btn btn-ghost quiet-danger" @click="openConfirm('login')">{{ L('解除登录方式…', 'ログイン方法を解除…') }}</button>
          </div>
        </section>

        <!-- 称号展示 -->
        <section id="acc-title" class="vsec" aria-labelledby="acc-title-h">
          <div class="section-head">
            <h2 id="acc-title-h" class="t-h2" tabindex="-1">{{ L('称号展示', '称号の表示') }}</h2>
            <RouterLink to="/titles" class="more">{{ L('全部称号', '称号一覧') }}</RouterLink>
          </div>
          <div class="panel panel-pad title-box">
            <div class="title-preview" aria-live="polite">
              <PlayerAvatar :name="nickname" :hue="HUE" :dan="player.dan" :size="44" />
              <div class="grow">
                <b class="title-1l" :title="nickname">{{ nickname }}</b>
                <span class="row-wrap"><TitlePlate :text="shownTitle" :rare="shownRare" /><DanBadge :dan="player.dan" /></span>
              </div>
            </div>
            <div class="field">
              <label for="acc-title-sel">{{ L('展示的称号', '表示する称号') }}</label>
              <select id="acc-title-sel" v-model="shownTitle" class="select" @change="onTitle">
                <option v-for="t in TITLES" :key="t.text" :value="t.text">{{ t.text }}</option>
              </select>
            </div>
          </div>
        </section>

        <!-- 第三方应用授权 -->
        <section id="acc-apps" class="vsec" aria-labelledby="acc-apps-h">
          <div class="section-head"><h2 id="acc-apps-h" class="t-h2" tabindex="-1">{{ L('第三方应用授权', '連携アプリ') }}</h2></div>
          <div class="panel">
            <template v-if="apps.length">
              <div class="only-desktop scroll-x">
                <table class="dt">
                  <caption class="sr-only">{{ L('已授权的第三方应用', '許可した連携アプリ') }}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{{ L('应用', 'アプリ') }}</th>
                      <th scope="col">{{ L('权限', '権限') }}</th>
                      <th scope="col">{{ L('状态', '状態') }}</th>
                      <th scope="col">{{ L('到期', '有効期限') }}</th>
                      <th scope="col">{{ L('最近使用', '最終利用') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="a in apps" :key="a.name">
                      <th scope="row"><b>{{ a.name }}</b></th>
                      <td><span class="row-wrap scopes"><span v-for="s in a.scopes" :key="s" class="tag num">{{ s }}</span></span></td>
                      <td>
                        <span v-if="expired(a)" class="tag tag-roll"><Icon name="clock" :size="12" />{{ L('已过期', '期限切れ') }}</span>
                        <span v-else class="tag tag-ok"><Icon name="check" :size="12" />{{ L('有效', '有効') }}</span>
                      </td>
                      <td class="num">{{ a.expires }}</td>
                      <td>{{ a.lastUsed }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <ul class="only-mobile rows">
                <li v-for="a in apps" :key="a.name" class="app">
                  <div class="spread">
                    <b>{{ a.name }}</b>
                    <span v-if="expired(a)" class="tag tag-roll"><Icon name="clock" :size="12" />{{ L('已过期', '期限切れ') }}</span>
                    <span v-else class="tag tag-ok"><Icon name="check" :size="12" />{{ L('有效', '有効') }}</span>
                  </div>
                  <span class="row-wrap scopes"><span v-for="s in a.scopes" :key="s" class="tag num">{{ s }}</span></span>
                  <dl class="kv">
                    <dt>{{ L('授权时间', '許可日') }}</dt>
                    <dd class="num">{{ a.granted }}</dd>
                    <dt>{{ L('到期', '有効期限') }}</dt>
                    <dd class="num">{{ a.expires }}</dd>
                    <dt>{{ L('最近使用', '最終利用') }}</dt>
                    <dd>{{ a.lastUsed }}</dd>
                  </dl>
                </li>
              </ul>
            </template>
            <EmptyLane v-else compact :title="L('没有已授权的应用', '許可したアプリはありません')" />
          </div>
          <div v-if="apps.length" class="danger-zone">
            <button type="button" class="btn btn-ghost quiet-danger" @click="openConfirm('revoke')">{{ L('撤销应用授权…', 'アプリの許可を取り消す…') }}</button>
          </div>
        </section>

        <!-- 退出登录（不是破坏性操作） -->
        <section id="acc-out" class="vsec out-sec" aria-labelledby="acc-out-h">
          <div class="grow">
            <h2 id="acc-out-h" class="t-h3" tabindex="-1">{{ L('退出登录', 'ログアウト') }}</h2>
            <span class="t-small">{{ L(`在这台设备上退出 ${player.username}`, `この端末で ${player.username} からログアウトします`) }}</span>
          </div>
          <button type="button" class="btn" @click="logout"><Icon name="logout" :size="16" />{{ L('退出登录', 'ログアウト') }}</button>
        </section>
      </div>
    </div>

    <!-- 编辑资料 -->
    <Sheet :open="editOpen" :title="L('编辑资料', 'プロフィールを編集')" @close="editOpen = false">
      <form class="col form" novalidate @submit.prevent="saveProfile">
        <div class="avatar-edit">
          <PlayerAvatar :name="draft.nickname || nickname" :hue="HUE" :dan="player.dan" :size="72" />
          <div class="col grow">
            <button type="button" class="btn" @click="draft.file = 'avatar.png'"><Icon name="upload" :size="16" />{{ L('选择图片', '画像を選択') }}</button>
            <span v-if="draft.file" class="t-small num">{{ draft.file }}</span>
            <span class="field-hint">{{ L('JPG 或 PNG，不超过 2 MB', 'JPG / PNG、2 MB まで') }}</span>
          </div>
        </div>
        <div class="field">
          <label for="acc-nick">{{ L('昵称', 'ニックネーム') }}</label>
          <input
            id="acc-nick"
            v-model="draft.nickname"
            class="input"
            :class="{ 'is-error': draft.error }"
            maxlength="16"
            autocomplete="nickname"
            enterkeyhint="done"
            :aria-invalid="!!draft.error"
            :aria-describedby="draft.error ? 'acc-nick-err' : undefined"
            @input="draft.error = ''"
          />
          <span v-if="draft.error" id="acc-nick-err" class="field-error" role="alert">{{ draft.error }}</span>
        </div>
        <div class="field">
          <span class="field-label">{{ L('用户名', 'ユーザー名') }}</span>
          <span class="num">@{{ player.username }}</span>
        </div>
      </form>
      <template #foot>
        <button type="button" class="btn" @click="editOpen = false">{{ L('取消', 'キャンセル') }}</button>
        <button type="button" class="btn btn-primary" @click="saveProfile">{{ L('保存修改', '変更を保存') }}</button>
      </template>
    </Sheet>

    <!-- 添加账号 -->
    <Sheet :open="addOpen" :title="L('添加账号', 'アカウントを追加')" @close="addOpen = false">
      <ul class="opts">
        <li>
          <RouterLink to="/bind" class="opt" @click="addOpen = false">
            <span class="tag region">CN</span>
            <span class="grow"><b>{{ L('鼓众广场 ID', '鼓衆広場 ID') }}</b><small>{{ L('国服，改一次游戏内称号完成验证', '中国版。ゲーム内の称号を変更して確認します') }}</small></span>
            <Icon name="chevR" :size="16" />
          </RouterLink>
        </li>
        <li>
          <RouterLink :to="{ path: '/bind', query: { source: 'hiroba' } }" class="opt" @click="addOpen = false">
            <span class="tag region">JP</span>
            <span class="grow"><b>Donder Hiroba</b><small>{{ L('日服', '日本版') }}</small></span>
            <Icon name="chevR" :size="16" />
          </RouterLink>
        </li>
        <li class="opt">
          <span class="tag region">{{ L('手动', '手動') }}</span>
          <div class="grow">
            <b>{{ L('手动成绩账号', '手動記録アカウント') }}</b>
            <div class="manual">
              <button type="button" class="btn" @click="createManual">{{ L('创建空账号', '空のアカウントを作成') }}</button>
              <form class="claim" novalidate @submit.prevent="claimManual">
                <input
                  v-model="claim.code"
                  class="input num"
                  :class="{ 'is-error': claim.error }"
                  maxlength="8"
                  autocomplete="off"
                  autocapitalize="characters"
                  enterkeyhint="go"
                  :placeholder="L('8 位认领码', '8 桁の引き継ぎコード')"
                  :aria-label="L('认领码', '引き継ぎコード')"
                  :aria-invalid="!!claim.error"
                  :aria-describedby="claim.error ? 'acc-claim-err' : undefined"
                  @input="claim.error = ''"
                />
                <button type="submit" class="btn">{{ L('认领', '引き継ぐ') }}</button>
              </form>
            </div>
            <span v-if="claim.error" id="acc-claim-err" class="field-error" role="alert">{{ claim.error }}</span>
          </div>
        </li>
        <li>
          <button type="button" class="opt" :disabled="qqSent" @click="sendQqCode">
            <span class="tag region"><Icon name="mail" :size="14" /></span>
            <span class="grow"><b>{{ L('从 QQ 机器人迁移绑定', 'QQ ボットの連携を移行') }}</b><small>{{ qqSent ? L('验证码已发送，10 分钟内有效', '確認コードを送信しました（10 分間有効）') : L('邮箱验证码', 'メールの確認コード') }}</small></span>
            <Icon :name="qqSent ? 'check' : 'chevR'" :size="16" />
          </button>
        </li>
      </ul>
    </Sheet>

    <!-- 破坏性操作确认 -->
    <Sheet :open="confirm.open" :title="cfg ? cfg.title() : ''" :width="460" @close="confirm.open = false">
      <div v-if="cfg" class="col form">
        <fieldset v-if="cfgOptions.length > 1" class="pick">
          <legend class="field-label">{{ L('选择对象', '対象を選択') }}</legend>
          <label v-for="o in cfgOptions" :key="o.v" class="pick-opt">
            <input v-model="confirm.pick" type="radio" name="acc-confirm-pick" :value="o.v" />
            <span class="title-1l" :title="o.label">{{ o.label }}</span>
          </label>
        </fieldset>
        <p v-if="cfgItem != null" class="consequence">{{ cfg.consequence(cfgItem) }}</p>
      </div>
      <template #foot>
        <button type="button" class="btn" @click="confirm.open = false">{{ L('取消', 'キャンセル') }}</button>
        <button type="button" class="btn btn-danger" :disabled="cfgItem == null" @click="runConfirm">{{ cfg && cfgItem != null ? cfg.action(cfgItem) : '' }}</button>
      </template>
    </Sheet>

    <!-- 修改密码 -->
    <Sheet :open="pwOpen" :title="L('修改密码', 'パスワードを変更')" :width="440" @close="pwOpen = false">
      <form class="col form" novalidate @submit.prevent="savePw">
        <input type="text" class="sr-only" autocomplete="username" :value="player.username" tabindex="-1" aria-hidden="true" readonly />
        <div class="field">
          <label for="pw-cur">{{ L('当前密码', '現在のパスワード') }}</label>
          <input id="pw-cur" v-model="pw.cur" type="password" class="input" autocomplete="current-password" enterkeyhint="next" :aria-describedby="pw.error ? 'pw-err' : undefined" @input="pw.error = ''" />
        </div>
        <div class="field">
          <label for="pw-next">{{ L('新密码', '新しいパスワード') }}</label>
          <input id="pw-next" v-model="pw.next" type="password" class="input" autocomplete="new-password" enterkeyhint="next" :aria-describedby="pw.error ? 'pw-err pw-next-hint' : 'pw-next-hint'" @input="pw.error = ''" />
          <span id="pw-next-hint" class="field-hint">{{ L('至少 8 位', '8 文字以上') }}</span>
        </div>
        <div class="field">
          <label for="pw-again">{{ L('再输入一次新密码', '新しいパスワード（確認）') }}</label>
          <input id="pw-again" v-model="pw.again" type="password" class="input" autocomplete="new-password" enterkeyhint="done" :aria-describedby="pw.error ? 'pw-err' : undefined" @input="pw.error = ''" />
        </div>
        <span v-if="pw.error" id="pw-err" class="field-error" role="alert">{{ pw.error }}</span>
      </form>
      <template #foot>
        <button type="button" class="btn" @click="pwOpen = false">{{ L('取消', 'キャンセル') }}</button>
        <button type="button" class="btn btn-primary" @click="savePw">{{ L('保存新密码', '新しいパスワードを保存') }}</button>
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
  border-left-color: var(--ink);
  color: var(--ink);
  font-weight: 700;
}

/* ---------- 身份 ---------- */
.ident {
  display: flex;
  align-items: center;
  gap: var(--sp-5);
  padding-bottom: var(--sp-6);
  border-bottom: 1px solid var(--line-strong);
}
.ident-main {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.ident-name {
  font-size: var(--fs-22);
  font-weight: 700;
  line-height: var(--lh-snug);
}
.ident-plates {
  gap: 6px;
}
.ident-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 18px;
  font-size: var(--fs-14);
  color: var(--ink-2);
}
.mail {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-width: 100%;
}

/* ---------- 状态行 ---------- */
.rows > li {
  border-bottom: 1px solid var(--line);
}
.rows > li:last-child {
  border-bottom: 0;
}
.srow {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  min-height: 64px;
  padding: var(--sp-3) var(--sp-5);
  font-size: var(--fs-14);
  color: var(--ink-2);
}
.srow .grow {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.4;
}
.srow b {
  color: var(--ink);
  font-size: var(--fs-16);
}
.srow-name {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.srow-sub {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 14px;
  font-size: var(--fs-14);
  color: var(--ink-2);
}
.region {
  flex: none;
  justify-content: center;
  min-width: 40px;
  font-size: var(--fs-12);
  font-weight: 700;
}
.ring {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1.5px currentColor;
  flex: none;
}
.panel-foot {
  padding: var(--sp-3) var(--sp-5);
  border-top: 1px solid var(--line);
}
.danger-zone {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--sp-2);
}
.quiet-danger {
  color: var(--danger);
}
.quiet-danger:hover {
  color: var(--danger);
  background: var(--danger-wash);
}

/* ---------- 称号 ---------- */
.title-box {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}
.title-preview {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-3);
  border: 1px solid var(--line);
  border-radius: var(--r-ctl);
}
.title-preview .grow {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.title-preview .row-wrap {
  gap: 6px;
}

/* ---------- 应用 ---------- */
.panel > .scroll-x {
  border-radius: inherit;
}
.dt th[scope='row'] {
  text-align: left;
  font-weight: 400;
}
.scopes {
  gap: 4px;
}
.app {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  padding: var(--sp-4);
}

/* ---------- 退出 ---------- */
.out-sec {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  padding-top: var(--sp-6);
  border-top: 1px solid var(--line-strong);
}
.out-sec .grow {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* ---------- 弹层内容 ---------- */
.form {
  gap: var(--sp-4);
}
.avatar-edit {
  display: flex;
  align-items: flex-start;
  gap: var(--sp-4);
}
.avatar-edit .col {
  align-items: flex-start;
  gap: 6px;
}
.opts {
  border-top: 1px solid var(--line-strong);
}
.opts > li {
  border-bottom: 1px solid var(--line);
}
.opt {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  width: 100%;
  min-height: 56px;
  padding: var(--sp-3) 0;
  text-align: left;
  color: var(--ink-2);
}
li.opt {
  align-items: flex-start;
}
.opt b {
  display: block;
  color: var(--ink);
}
.opt small {
  display: block;
  font-size: var(--fs-13);
  color: var(--ink-2);
}
a.opt:hover b,
button.opt:hover b {
  color: var(--ka-ink);
}
button.opt[disabled] {
  cursor: default;
}
.manual {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 8px 0 4px;
}
.claim {
  display: flex;
  flex: 1;
  gap: 6px;
  min-width: 200px;
}
.pick {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  border: 0;
}
.pick legend {
  padding: 0;
  margin-bottom: 4px;
}
.pick-opt {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  min-height: 44px;
  min-width: 0;
  border-bottom: 1px solid var(--line);
  font-size: var(--fs-14);
  cursor: pointer;
}
.pick-opt input {
  flex: none;
  width: 18px;
  height: 18px;
  accent-color: var(--danger);
}
.consequence {
  font-size: var(--fs-16);
  line-height: var(--lh-body, 1.6);
}

@media (max-width: 767px) {
  .vcol {
    gap: var(--sp-8);
  }
  .ident {
    flex-wrap: wrap;
    gap: var(--sp-4);
  }
  .ident > .btn {
    width: 100%;
  }
  .srow {
    flex-wrap: wrap;
    padding: var(--sp-3) var(--sp-4);
  }
  .srow .grow {
    flex-basis: calc(100% - 80px);
  }
  .panel-foot {
    padding: var(--sp-3) var(--sp-4);
  }
  .panel-foot .btn {
    width: 100%;
  }
  .danger-zone .btn {
    width: 100%;
  }
  .out-sec {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
