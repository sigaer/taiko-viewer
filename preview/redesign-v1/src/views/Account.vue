<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Icon from '../components/Icon.vue'
import Sheet from '../components/Sheet.vue'
import EmptyLane from '../components/EmptyLane.vue'
import { player, devApps } from '../mock/data'
import { store, L, toast } from '../store'

const router = useRouter()
const EMAIL = 'mochi.don@example.com'

/* ---------- 资料 ---------- */
const nickname = ref(player.nickname)
const initial = computed(() => [...nickname.value][0])
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
function setCurrent(b) {
  bindings.value.forEach((x) => (x.current = x.id === b.id))
  toast(L(`已切换到「${b.name}」`, `「${b.name}」に切り替えました`))
}
const unbindTarget = ref(null)
function confirmUnbind() {
  const b = unbindTarget.value
  bindings.value = bindings.value.filter((x) => x.id !== b.id)
  if (b.current && bindings.value.length) bindings.value[0].current = true
  unbindTarget.value = null
  toast(L(`已解除「${b.name}」的绑定`, `「${b.name}」の連携を解除しました`))
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
function toggleOidc() {
  oidcLinked.value = !oidcLinked.value
  toast(oidcLinked.value ? L('已关联 OurTaiko', 'OurTaiko と連携しました') : L('已解除 OurTaiko 关联', 'OurTaiko の連携を解除しました'))
}
function toggleQq() {
  qqBound.value = !qqBound.value
  toast(qqBound.value ? L('QQ 已绑定', 'QQ を連携しました') : L('QQ 已解绑', 'QQ の連携を解除しました'))
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

/* ---------- 小咚与称号 ---------- */
const TITLES = [player.title, '太鼓好き', '九段合格', '全良收藏家', '节奏旅人']
const shownTitle = ref(player.title)
function onTitle() {
  toast(L(`展示称号已换成「${shownTitle.value}」`, `表示する称号を「${shownTitle.value}」に変更しました`))
}

/* ---------- 第三方应用 ---------- */
const apps = ref(devApps.map((a) => ({ ...a })))
function revoke(a) {
  apps.value = apps.value.filter((x) => x.name !== a.name)
  toast(L(`已撤销 ${a.name} 的授权`, `${a.name} の許可を取り消しました`))
}

function logout() {
  store.auth = 'guest'
  router.push('/')
}
</script>

<template>
  <div class="page account">
    <EmptyLane v-if="store.auth === 'guest'" :title="L('登录后管理账号', 'ログインしてアカウントを管理')">
      <RouterLink to="/login" class="btn btn-primary">{{ L('登录', 'ログイン') }}</RouterLink>
    </EmptyLane>

    <template v-else>
      <header class="ident">
        <span class="avatar lg">{{ initial }}</span>
        <div class="grow">
          <h1 class="t-h1">{{ nickname }}</h1>
          <p class="ident-meta">
            <span class="num">@{{ player.username }}</span>
            <span class="mail">{{ EMAIL }}<span class="tag tag-ok"><Icon name="check" :size="12" />{{ L('已验证', '確認済み') }}</span></span>
            <span><span class="num">{{ player.joined }}</span> {{ L('加入', '登録') }}</span>
          </p>
        </div>
        <div class="row-wrap">
          <button class="btn" @click="openEdit"><Icon name="image" :size="16" />{{ L('更换头像', 'アイコンを変更') }}</button>
          <button class="btn btn-ink" @click="openEdit"><Icon name="edit" :size="16" />{{ L('编辑资料', 'プロフィールを編集') }}</button>
        </div>
      </header>

      <div class="cols">
        <!-- 游戏账号 -->
        <section class="a-bind">
          <div class="section-head">
            <h2 class="t-h2">{{ L('游戏账号', 'ゲームアカウント') }}</h2>
            <span v-if="bindings.length" class="t-caption"><span class="num">{{ bindings.length }}</span> {{ L('个', '件') }}</span>
          </div>
          <div class="panel">
            <ul v-if="bindings.length" class="rows">
              <li v-for="b in bindings" :key="b.id" class="bind">
                <span class="stamp" :class="b.source">{{ stamp(b) }}</span>
                <div class="grow">
                  <p class="bind-name">
                    <b class="truncate">{{ b.name }}</b>
                    <span v-if="b.current" class="tag tag-don">{{ L('当前', '使用中') }}</span>
                  </p>
                  <p class="bind-sub">
                    <span class="num">{{ b.taikoId }}</span>
                    <span>{{ L(SOURCES[b.source].zh, SOURCES[b.source].ja) }}</span>
                    <span v-if="b.title !== '—'" class="bind-title"><Icon name="shield" :size="14" />{{ b.title }}</span>
                  </p>
                </div>
                <div class="bind-acts">
                  <RouterLink v-if="b.current" to="/account/sync" class="btn btn-sm"><Icon name="sync" :size="14" />{{ L('同步', '同期') }}</RouterLink>
                  <button v-else class="btn btn-sm" @click="setCurrent(b)">{{ L('设为当前', '使用中にする') }}</button>
                  <button class="btn btn-sm btn-ghost" @click="unbindTarget = b">{{ L('解除绑定', '連携を解除') }}</button>
                </div>
              </li>
            </ul>
            <EmptyLane v-else compact :title="L('还没有绑定游戏账号', 'ゲームアカウントが未連携です')" />
            <div class="panel-foot">
              <button class="btn" @click="openAdd"><Icon name="plus" :size="16" />{{ L('添加账号', 'アカウントを追加') }}</button>
            </div>
          </div>
        </section>

        <!-- 登录方式 -->
        <section class="a-login">
          <div class="section-head"><h2 class="t-h2">{{ L('登录方式', 'ログイン方法') }}</h2></div>
          <ul class="panel rows">
            <li class="lrow">
              <Icon name="mail" />
              <div class="grow">
                <b>{{ L('邮箱与密码', 'メールとパスワード') }}</b>
                <span class="t-caption truncate">{{ EMAIL }}</span>
              </div>
              <button class="btn btn-sm" @click="openPw">{{ L('修改密码', 'パスワードを変更') }}</button>
            </li>
            <li class="lrow">
              <Icon name="link" />
              <div class="grow">
                <b>OurTaiko</b>
                <span class="t-caption">OIDC</span>
              </div>
              <span class="tag" :class="{ 'tag-ok': oidcLinked }">{{ oidcLinked ? L('已关联', '連携済み') : L('未关联', '未連携') }}</span>
              <button class="btn btn-sm" :class="{ 'btn-ghost': oidcLinked }" @click="toggleOidc">{{ oidcLinked ? L('解除', '解除') : L('关联', '連携する') }}</button>
            </li>
            <li class="lrow">
              <Icon name="community" />
              <div class="grow">
                <b>QQ</b>
                <span v-if="qqBound" class="t-caption num">2841••••07</span>
              </div>
              <span class="tag" :class="{ 'tag-ok': qqBound }">{{ qqBound ? L('已绑定', '連携済み') : L('未绑定', '未連携') }}</span>
              <button class="btn btn-sm" :class="{ 'btn-ghost': qqBound }" @click="toggleQq">{{ qqBound ? L('解绑', '解除') : L('绑定', '連携する') }}</button>
            </li>
          </ul>
        </section>

        <!-- 小咚与称号 -->
        <section class="a-don">
          <div class="section-head"><h2 class="t-h2">{{ L('我的小咚与称号展示', 'マイどんと称号') }}</h2></div>
          <div class="panel panel-pad don-box">
            <div class="don-preview">
              <span class="donchan" aria-hidden="true"><i class="eye l" /><i class="eye r" /><i class="mouth" /></span>
              <div class="grow">
                <b class="truncate">{{ nickname }}</b>
                <span class="tag tag-roll">{{ shownTitle }}</span>
              </div>
            </div>
            <div class="field">
              <label for="acc-title">{{ L('展示的称号', '表示する称号') }}</label>
              <select id="acc-title" v-model="shownTitle" class="select" @change="onTitle">
                <option v-for="t in TITLES" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>
            <RouterLink to="/titles" class="link t-small">{{ L('查看全部称号', '称号一覧を見る') }}</RouterLink>
          </div>
        </section>

        <!-- 第三方应用授权 -->
        <section class="a-apps">
          <div class="section-head"><h2 class="t-h2">{{ L('第三方应用授权', '連携アプリ') }}</h2></div>
          <div class="panel">
            <template v-if="apps.length">
              <div class="only-desktop scroll-x">
                <table class="dt">
                  <thead>
                    <tr>
                      <th>{{ L('应用', 'アプリ') }}</th>
                      <th>{{ L('权限', '権限') }}</th>
                      <th>{{ L('授权时间', '許可日') }}</th>
                      <th>{{ L('到期', '有効期限') }}</th>
                      <th>{{ L('最近使用', '最終利用') }}</th>
                      <th class="r"><span class="sr-only">{{ L('操作', '操作') }}</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="a in apps" :key="a.name">
                      <td><b>{{ a.name }}</b></td>
                      <td><span class="row-wrap scopes"><span v-for="s in a.scopes" :key="s" class="tag num">{{ s }}</span></span></td>
                      <td class="num">{{ a.granted }}</td>
                      <td class="num">{{ a.expires }}</td>
                      <td>{{ a.lastUsed }}</td>
                      <td class="r"><button class="btn btn-sm" @click="revoke(a)">{{ L('撤销', '取り消す') }}</button></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <ul class="only-mobile rows">
                <li v-for="a in apps" :key="a.name" class="app">
                  <div class="spread">
                    <b>{{ a.name }}</b>
                    <button class="btn btn-sm" @click="revoke(a)">{{ L('撤销', '取り消す') }}</button>
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
        </section>

        <!-- 退出 -->
        <section class="a-danger">
          <div class="grow">
            <b>{{ L('退出登录', 'ログアウト') }}</b>
            <span class="t-small">{{ L(`在这台设备上退出 ${player.username}`, `この端末で ${player.username} からログアウトします`) }}</span>
          </div>
          <button class="btn out" @click="logout"><Icon name="logout" :size="16" />{{ L('退出登录', 'ログアウト') }}</button>
        </section>
      </div>
    </template>

    <!-- 编辑资料 -->
    <Sheet :open="editOpen" :title="L('编辑资料', 'プロフィールを編集')" @close="editOpen = false">
      <div class="col form">
        <div class="avatar-edit">
          <span class="avatar lg">{{ [...(draft.nickname || nickname)][0] }}</span>
          <div class="col grow">
            <button class="btn" @click="draft.file = 'avatar.png'"><Icon name="upload" :size="16" />{{ L('选择图片', '画像を選択') }}</button>
            <span v-if="draft.file" class="t-small num">{{ draft.file }}</span>
            <span class="field-hint">{{ L('JPG 或 PNG，不超过 2 MB，会裁成圆形。', 'JPG / PNG、2 MB まで。円形に切り抜かれます。') }}</span>
          </div>
        </div>
        <div class="field">
          <label for="acc-nick">{{ L('昵称', 'ニックネーム') }}</label>
          <input id="acc-nick" v-model="draft.nickname" class="input" :class="{ 'is-error': draft.error }" maxlength="16" @input="draft.error = ''" />
          <span v-if="draft.error" class="field-error">{{ draft.error }}</span>
        </div>
        <div class="field">
          <span class="field-label">{{ L('用户名', 'ユーザー名') }}</span>
          <span class="num">@{{ player.username }}</span>
        </div>
      </div>
      <template #foot>
        <button class="btn" @click="editOpen = false">{{ L('取消', 'キャンセル') }}</button>
        <button class="btn btn-primary" @click="saveProfile">{{ L('保存修改', '変更を保存') }}</button>
      </template>
    </Sheet>

    <!-- 添加账号 -->
    <Sheet :open="addOpen" :title="L('添加账号', 'アカウントを追加')" @close="addOpen = false">
      <ul class="opts">
        <li>
          <RouterLink to="/bind" class="opt" @click="addOpen = false">
            <span class="stamp wahlap">CN</span>
            <span class="grow"><b>{{ L('鼓众广场 ID', '鼓衆広場 ID') }}</b><small>{{ L('国服，改一次游戏内称号完成验证', '中国版。ゲーム内の称号を変更して確認します') }}</small></span>
            <Icon name="chevR" :size="16" />
          </RouterLink>
        </li>
        <li>
          <RouterLink :to="{ path: '/bind', query: { source: 'hiroba' } }" class="opt" @click="addOpen = false">
            <span class="stamp hiroba">JP</span>
            <span class="grow"><b>Donder Hiroba</b><small>{{ L('日服', '日本版') }}</small></span>
            <Icon name="chevR" :size="16" />
          </RouterLink>
        </li>
        <li class="opt">
          <span class="stamp manual">{{ L('手动', '手動') }}</span>
          <div class="grow">
            <b>{{ L('手动成绩账号', '手動記録アカウント') }}</b>
            <div class="manual">
              <button class="btn" @click="createManual">{{ L('创建空账号', '空のアカウントを作成') }}</button>
              <div class="claim">
                <input v-model="claim.code" class="input num" :class="{ 'is-error': claim.error }" maxlength="8" :placeholder="L('8 位认领码', '8 桁の引き継ぎコード')" :aria-label="L('认领码', '引き継ぎコード')" @input="claim.error = ''" />
                <button class="btn" @click="claimManual">{{ L('认领', '引き継ぐ') }}</button>
              </div>
            </div>
            <span v-if="claim.error" class="field-error">{{ claim.error }}</span>
          </div>
        </li>
        <li>
          <button class="opt" :disabled="qqSent" @click="sendQqCode">
            <span class="stamp manual"><Icon name="mail" :size="18" /></span>
            <span class="grow"><b>{{ L('从 QQ 机器人迁移绑定', 'QQ ボットの連携を移行') }}</b><small>{{ qqSent ? L('验证码已发送，10 分钟内有效', '確認コードを送信しました（10 分間有効）') : L('邮箱验证码', 'メールの確認コード') }}</small></span>
            <Icon :name="qqSent ? 'check' : 'chevR'" :size="16" />
          </button>
        </li>
      </ul>
    </Sheet>

    <!-- 解除绑定 -->
    <Sheet :open="!!unbindTarget" :title="L('解除绑定', '連携を解除')" :width="440" @close="unbindTarget = null">
      <p v-if="unbindTarget">{{ L(`解除后，「${unbindTarget.name}」的成绩不再出现在你的成绩和成长记录里。重新绑定可以恢复。`, `解除すると「${unbindTarget.name}」のスコアは成績と成長記録に表示されなくなります。再連携で元に戻せます。`) }}</p>
      <template #foot>
        <button class="btn" @click="unbindTarget = null">{{ L('取消', 'キャンセル') }}</button>
        <button class="btn btn-danger" @click="confirmUnbind">{{ L('解除绑定', '連携を解除') }}</button>
      </template>
    </Sheet>

    <!-- 修改密码 -->
    <Sheet :open="pwOpen" :title="L('修改密码', 'パスワードを変更')" :width="440" @close="pwOpen = false">
      <form class="col form" @submit.prevent="savePw">
        <div class="field">
          <label for="pw-cur">{{ L('当前密码', '現在のパスワード') }}</label>
          <input id="pw-cur" v-model="pw.cur" type="password" class="input" autocomplete="current-password" @input="pw.error = ''" />
        </div>
        <div class="field">
          <label for="pw-next">{{ L('新密码', '新しいパスワード') }}</label>
          <input id="pw-next" v-model="pw.next" type="password" class="input" autocomplete="new-password" @input="pw.error = ''" />
          <span class="field-hint">{{ L('至少 8 位', '8 文字以上') }}</span>
        </div>
        <div class="field">
          <label for="pw-again">{{ L('再输入一次新密码', '新しいパスワード（確認）') }}</label>
          <input id="pw-again" v-model="pw.again" type="password" class="input" autocomplete="new-password" @input="pw.error = ''" />
        </div>
        <span v-if="pw.error" class="field-error" role="alert">{{ pw.error }}</span>
      </form>
      <template #foot>
        <button class="btn" @click="pwOpen = false">{{ L('取消', 'キャンセル') }}</button>
        <button class="btn btn-primary" @click="savePw">{{ L('保存新密码', '新しいパスワードを保存') }}</button>
      </template>
    </Sheet>
  </div>
</template>

<style scoped>
.ident {
  display: flex;
  align-items: center;
  gap: var(--sp-5);
  flex-wrap: wrap;
  padding-bottom: var(--sp-6);
  border-bottom: 1px solid var(--line-strong);
}
.ident-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 18px;
  margin-top: 8px;
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.ident-meta .num {
  font-size: var(--fs-14);
}
.mail {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.cols {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  grid-template-areas:
    'bind don'
    'login don'
    'apps apps'
    'danger danger';
  align-items: start;
  gap: var(--sp-10) var(--sp-8);
  margin-top: var(--sp-8);
}
.a-bind {
  grid-area: bind;
}
.a-login {
  grid-area: login;
}
.a-don {
  grid-area: don;
}
.a-apps {
  grid-area: apps;
}
.a-danger {
  grid-area: danger;
}
.cols > section {
  min-width: 0;
}
.rows > li {
  border-bottom: 1px solid var(--line);
}
.rows > li:last-child {
  border-bottom: 0;
}
.panel-foot {
  padding: var(--sp-3) var(--sp-5);
  border-top: 1px solid var(--line);
}
.panel > .scroll-x {
  border-radius: inherit;
}

/* 区服印章 */
.stamp {
  display: inline-grid;
  place-items: center;
  flex: none;
  width: 44px;
  height: 44px;
  border-radius: var(--r-ctl);
  border: 1.5px solid currentColor;
  background: var(--bg-sunk);
  color: var(--ink-2);
  font-family: var(--font-num);
  font-size: var(--fs-14);
  font-weight: 700;
  letter-spacing: 0.04em;
}
.stamp.wahlap {
  background: var(--don-wash);
  color: var(--don-ink);
}
.stamp.hiroba {
  background: var(--ka-wash);
  color: var(--ka-ink);
}
.bind {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  padding: var(--sp-4) var(--sp-5);
}
.bind-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--fs-16);
}
.bind-sub {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 14px;
  margin-top: 2px;
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.bind-sub .num {
  font-size: var(--fs-14);
  color: var(--ink);
}
.bind-title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--ok);
}
.bind-acts {
  display: flex;
  gap: 6px;
  flex: none;
}
.lrow {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  min-height: 64px;
  padding: var(--sp-3) var(--sp-5);
  color: var(--ink-2);
}
.lrow .grow {
  display: flex;
  flex-direction: column;
  line-height: 1.35;
}
.lrow b {
  color: var(--ink);
}

/* 小咚 */
.don-box {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}
.don-preview {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
}
.don-preview .grow {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  font-size: var(--fs-16);
}
.donchan {
  position: relative;
  flex: none;
  width: 84px;
  height: 84px;
  border-radius: 50%;
  background: var(--ai-0);
  box-shadow: inset 0 0 0 9px var(--don), 0 0 0 2px var(--line-strong);
}
.donchan .eye {
  position: absolute;
  top: 32px;
  width: 9px;
  height: 12px;
  border-radius: 50%;
  background: var(--ai-900);
}
.donchan .eye.l {
  left: 25px;
}
.donchan .eye.r {
  right: 25px;
}
.donchan .mouth {
  position: absolute;
  left: 50%;
  top: 46px;
  width: 16px;
  height: 9px;
  margin-left: -8px;
  border-radius: 0 0 9px 9px;
  background: var(--don);
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
.a-danger {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  padding: var(--sp-5) 0;
  border-top: 1px solid var(--line-strong);
  border-bottom: 1px solid var(--line-strong);
}
.a-danger .grow {
  display: flex;
  flex-direction: column;
}
.out {
  color: var(--danger);
}

/* Sheet 内容 */
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
  padding: var(--sp-3) 0;
  text-align: left;
  color: var(--ink-3);
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
  font-size: var(--fs-12);
  color: var(--ink-3);
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

@media (max-width: 1099px) {
  .cols {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--sp-8);
  }
}
@media (max-width: 767px) {
  .ident {
    gap: var(--sp-4);
  }
  .ident > .row-wrap {
    width: 100%;
  }
  .ident > .row-wrap .btn {
    flex: 1;
  }
  .bind {
    flex-wrap: wrap;
    padding: var(--sp-4);
  }
  .bind-acts {
    width: 100%;
    padding-left: 60px;
  }
  .lrow {
    padding: var(--sp-3) var(--sp-4);
  }
  .panel-foot {
    padding: var(--sp-3) var(--sp-4);
  }
  .panel-foot .btn {
    width: 100%;
  }
  .a-danger {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
