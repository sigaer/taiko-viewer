<script setup>
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import Icon from '../components/Icon.vue'
import Sheet from '../components/Sheet.vue'
import EmptyLane from '../components/EmptyLane.vue'
import { store, L, toast } from '../store'

const CATS = {
  account: { zh: '账号', ja: 'アカウント' },
  score: { zh: '成绩', ja: 'スコア' },
  catalog: { zh: '曲库数据', ja: '楽曲データ' },
  alias: { zh: '别名', ja: '別名' },
  other: { zh: '其他', ja: 'その他' },
}
const STATUS = {
  waiting: { zh: '待回复', ja: '返信待ち', cls: 'tag-roll' },
  working: { zh: '处理中', ja: '対応中', cls: 'tag-ka' },
  done: { zh: '已解决', ja: '解決済み', cls: 'tag-ok' },
}
const NOW = '11-16 20:46'

const tickets = ref([
  {
    id: 2187, cat: 'score', status: 'waiting', updated: '11-16 19:20', title: '千本桜（里）全良后，歌曲页的王冠还是全连',
    messages: [
      { from: 'me', at: '11-16 18:55', text: '打出了全良，同步后成长记录里有「新全良」，但歌曲页的王冠还是金色。' },
      { from: 'staff', at: '11-16 19:05', text: '收到。能告诉我们是哪一次同步吗？我们查一下那次的成绩快照。' },
      { from: 'me', at: '11-16 19:20', text: '今天 18:42 那一次。' },
    ],
  },
  {
    id: 2179, cat: 'account', status: 'working', updated: '11-15 14:02', title: '解除绑定后想找回原来的手动成绩账号',
    messages: [
      { from: 'me', at: '11-14 22:31', text: '上周误点了解除绑定，家用机那份手动成绩账号不见了，还能恢复吗？' },
      { from: 'staff', at: '11-15 14:02', text: '可以恢复。已经找到这份账号，正在生成新的 8 位认领码，稍后回复在这里。' },
    ],
  },
  {
    id: 2164, cat: 'alias', status: 'working', updated: '11-13 10:47', title: '「ラーメン de Yo‐Men!!」的中文别名建议',
    messages: [
      { from: 'me', at: '11-12 23:10', text: '现在的译名是「拉面 德 呦-面!!」，机厅里一般叫「拉面哟面」，希望两个都能搜到。' },
      { from: 'staff', at: '11-13 10:47', text: '已加入别名候选，本周的别名修改日志发布后生效。' },
    ],
  },
  {
    id: 2142, cat: 'catalog', status: 'done', updated: '11-08 16:30', title: '幽玄ノ乱 鬼的谱面图少了两个音符',
    messages: [
      { from: 'me', at: '11-07 21:15', text: '歌曲页和游戏结算都是 1262，但谱面图数下来只有 1260。' },
      { from: 'staff', at: '11-08 11:20', text: '第 87 小节有两个音符被标记遮住了，谱面图已重新生成。' },
      { from: 'me', at: '11-08 16:30', text: '看到了，现在是对的，谢谢。' },
    ],
  },
  {
    id: 2098, cat: 'other', status: 'done', updated: '10-29 09:12', title: '年度回顾海报导出后字体变了',
    messages: [
      { from: 'me', at: '10-28 20:40', text: '手机上导出 PNG，标题变成了系统默认字体。' },
      { from: 'staff', at: '10-29 09:12', text: '导出时字体还没有加载完。已修复，重新导出一次就可以。' },
    ],
  },
])

/* ---------- 筛选 ---------- */
const fStatus = ref('all')
const fCat = ref('all')
const filtered = computed(() => tickets.value.filter((t) => (fStatus.value === 'all' || t.status === fStatus.value) && (fCat.value === 'all' || t.cat === fCat.value)))
function resetFilters() {
  fStatus.value = 'all'
  fCat.value = 'all'
}

/* ---------- 主从：宽屏右侧详情栏，窄屏用 Sheet ---------- */
const mq = window.matchMedia('(max-width: 1099px)')
const narrow = ref(mq.matches)
const activeId = ref(narrow.value ? null : tickets.value[0].id)
const onMq = (e) => {
  narrow.value = e.matches
  activeId.value = e.matches ? null : (activeId.value ?? tickets.value[0].id)
}
mq.addEventListener('change', onMq)
onBeforeUnmount(() => mq.removeEventListener('change', onMq))
const active = computed(() => tickets.value.find((t) => t.id === activeId.value) || null)
const detailTag = computed(() => (narrow.value ? Sheet : 'aside'))
const detailProps = computed(() => (narrow.value ? { open: !!active.value, title: active.value ? active.value.title : '', width: 600 } : { class: 'detail panel' }))

const reply = reactive({ text: '', error: '' })
function openTicket(t) {
  activeId.value = t.id
  reply.text = ''
  reply.error = ''
}
function send() {
  const text = reply.text.trim()
  if (!text) {
    reply.error = L('回复内容是空的，写点什么再发送。', '返信が空です。内容を入力してから送信してください。')
    return
  }
  const t = active.value
  t.messages.push({ from: 'me', at: NOW, text })
  t.status = 'waiting'
  t.updated = NOW
  reply.text = ''
  toast(L('回复已发送', '返信を送信しました'))
}
function reopen() {
  active.value.status = 'working'
  toast(L('工单已重新打开', 'チケットを再開しました'))
}

/* ---------- 新建工单 ---------- */
const newOpen = ref(false)
const draft = reactive({ cat: 'account', title: '', desc: '', shots: [], error: '' })
let shotSeq = 0
function openNew() {
  Object.assign(draft, { cat: 'account', title: '', desc: '', shots: [], error: '' })
  newOpen.value = true
}
function addShot() {
  if (draft.shots.length < 4) draft.shots.push(`screenshot-${++shotSeq}.png`)
}
function submitNew() {
  const title = draft.title.trim()
  if (!title) {
    draft.error = L('请填写标题，用一句话说明遇到的问题。', 'タイトルを入力してください。問題を一文でまとめます。')
    return
  }
  const id = Math.max(...tickets.value.map((t) => t.id)) + 1
  tickets.value.unshift({ id, cat: draft.cat, status: 'waiting', updated: NOW, title, messages: [{ from: 'me', at: NOW, text: draft.desc.trim() || title }] })
  newOpen.value = false
  resetFilters()
  if (!narrow.value) openTicket(tickets.value[0])
  toast(L(`工单 #${id} 已提交`, `チケット #${id} を送信しました`))
}
</script>

<template>
  <div class="page support">
    <EmptyLane v-if="store.auth === 'guest'" :title="L('登录后管理账号', 'ログインしてアカウントを管理')">
      <RouterLink to="/login" class="btn btn-primary">{{ L('登录', 'ログイン') }}</RouterLink>
    </EmptyLane>

    <template v-else>
      <div class="bar">
        <div class="seg" role="group" :aria-label="L('状态', '状態')">
          <button :aria-pressed="fStatus === 'all'" @click="fStatus = 'all'">{{ L('全部', 'すべて') }}</button>
          <button v-for="(s, k) in STATUS" :key="k" :aria-pressed="fStatus === k" @click="fStatus = k">{{ L(s.zh, s.ja) }}</button>
        </div>
        <select v-model="fCat" class="select cat" :aria-label="L('分类', 'カテゴリ')">
          <option value="all">{{ L('全部分类', 'すべてのカテゴリ') }}</option>
          <option v-for="(c, k) in CATS" :key="k" :value="k">{{ L(c.zh, c.ja) }}</option>
        </select>
        <button class="btn btn-primary new" @click="openNew"><Icon name="plus" :size="16" />{{ L('新建工单', 'チケットを作成') }}</button>
      </div>

      <div class="md">
        <section class="panel list" :aria-label="L('我的工单', '自分のチケット')">
          <ul v-if="filtered.length" class="rows">
            <li v-for="t in filtered" :key="t.id">
              <button class="tk" :class="{ on: !narrow && t.id === activeId }" :aria-current="!narrow && t.id === activeId ? 'true' : null" @click="openTicket(t)">
                <span class="tk-title">{{ t.title }}</span>
                <span class="tk-meta">
                  <span class="tag">{{ L(CATS[t.cat].zh, CATS[t.cat].ja) }}</span>
                  <span class="tag" :class="STATUS[t.status].cls">{{ L(STATUS[t.status].zh, STATUS[t.status].ja) }}</span>
                  <span class="grow" />
                  <span class="tk-n"><Icon name="reply" :size="14" /><span class="num">{{ t.messages.length - 1 }}</span><span class="sr-only">{{ L('条回复', '件の返信') }}</span></span>
                  <span class="num tk-time">{{ t.updated }}</span>
                </span>
              </button>
            </li>
          </ul>
          <EmptyLane v-else compact :title="L('没有符合条件的工单', '条件に合うチケットはありません')">
            <button class="btn" @click="resetFilters">{{ L('清除筛选', '絞り込みを解除') }}</button>
          </EmptyLane>
        </section>

        <component :is="detailTag" v-bind="detailProps" @close="activeId = null">
          <template v-if="active">
            <header class="d-head">
              <h2 v-if="!narrow" class="t-h2">{{ active.title }}</h2>
              <p class="row-wrap">
                <span class="tag">{{ L(CATS[active.cat].zh, CATS[active.cat].ja) }}</span>
                <span class="tag" :class="STATUS[active.status].cls">{{ L(STATUS[active.status].zh, STATUS[active.status].ja) }}</span>
                <span class="num faint">#{{ active.id }}</span>
              </p>
            </header>
            <ol class="msgs">
              <li v-for="(m, i) in active.messages" :key="i" class="msg" :class="m.from">
                <p class="msg-head">
                  <span v-if="m.from === 'staff'" class="role admin">{{ L('站务', '運営') }}</span>
                  <b v-else>{{ L('我', '自分') }}</b>
                  <span class="num t-caption">{{ m.at }}</span>
                </p>
                <p class="msg-text">{{ m.text }}</p>
              </li>
            </ol>
            <form v-if="active.status !== 'done'" class="reply" @submit.prevent="send">
              <label for="sup-reply" class="sr-only">{{ L('回复', '返信') }}</label>
              <textarea id="sup-reply" v-model="reply.text" class="textarea" rows="3" :placeholder="L('补充信息或回复站务', '補足や運営への返信を入力')" @input="reply.error = ''" />
              <span v-if="reply.error" class="field-error">{{ reply.error }}</span>
              <div class="reply-foot">
                <span class="field-hint">{{ L('站务通常在 1 个工作日内回复', '運営からの返信は通常 1 営業日以内') }}</span>
                <button type="submit" class="btn btn-primary">{{ L('发送回复', '返信を送信') }}</button>
              </div>
            </form>
            <div v-else class="reply solved">
              <span class="t-small">{{ L('这条工单已解决。问题再次出现时可以重新打开。', 'このチケットは解決済みです。再発した場合は再開できます。') }}</span>
              <button class="btn btn-sm" @click="reopen">{{ L('重新打开', '再開する') }}</button>
            </div>
          </template>
          <EmptyLane v-else compact :title="L('选一条工单查看对话', 'チケットを選んでやり取りを表示')" />
        </component>
      </div>
    </template>

    <!-- 新建工单 -->
    <Sheet :open="newOpen" :title="L('新建工单', 'チケットを作成')" @close="newOpen = false">
      <form class="col form" novalidate @submit.prevent="submitNew">
        <div class="field">
          <label for="sup-cat">{{ L('分类', 'カテゴリ') }}</label>
          <select id="sup-cat" v-model="draft.cat" class="select">
            <option v-for="(c, k) in CATS" :key="k" :value="k">{{ L(c.zh, c.ja) }}</option>
          </select>
        </div>
        <div class="field">
          <label for="sup-title">{{ L('标题', 'タイトル') }}</label>
          <input id="sup-title" v-model="draft.title" class="input" :class="{ 'is-error': draft.error }" maxlength="60" @input="draft.error = ''" />
          <span v-if="draft.error" class="field-error">{{ draft.error }}</span>
        </div>
        <div class="field">
          <label for="sup-desc">{{ L('描述', '詳細') }}</label>
          <textarea id="sup-desc" v-model="draft.desc" class="textarea" rows="5" :placeholder="L('发生了什么、在哪个页面、期望的结果', '何が起きたか、どの画面か、期待した結果')" />
        </div>
        <div class="row-wrap">
          <button type="button" class="btn btn-sm" :disabled="draft.shots.length >= 4" @click="addShot"><Icon name="image" :size="14" />{{ L('添加截图', 'スクリーンショットを追加') }}</button>
          <span v-for="(f, i) in draft.shots" :key="f" class="chip">
            <span class="num">{{ f }}</span>
            <button type="button" class="x" :aria-label="L('移除', '削除')" @click="draft.shots.splice(i, 1)"><Icon name="close" :size="14" /></button>
          </span>
        </div>
      </form>
      <template #foot>
        <button class="btn" @click="newOpen = false">{{ L('取消', 'キャンセル') }}</button>
        <button class="btn btn-primary" @click="submitNew">{{ L('提交工单', 'チケットを送信') }}</button>
      </template>
    </Sheet>
  </div>
</template>

<style scoped>
.bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--sp-3);
  margin-bottom: var(--sp-5);
}
.cat {
  width: 160px;
}
.new {
  margin-left: auto;
}
.md {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
  align-items: start;
  gap: var(--sp-6);
}
.rows > li {
  border-bottom: 1px solid var(--line);
}
.rows > li:last-child {
  border-bottom: 0;
}

/* 工单行 */
.tk {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  padding: var(--sp-4) var(--sp-5);
  text-align: left;
  transition: background var(--dur-1);
}
.rows > li:first-child .tk {
  border-radius: var(--r-panel) var(--r-panel) 0 0;
}
.rows > li:last-child .tk {
  border-radius: 0 0 var(--r-panel) var(--r-panel);
}
.tk:hover {
  background: var(--surface-2);
}
.tk.on {
  background: var(--surface-2);
  box-shadow: inset 3px 0 0 var(--don);
}
.tk-title {
  font-size: var(--fs-16);
  font-weight: 700;
  line-height: var(--lh-snug);
}
.tk-meta {
  display: flex;
  align-items: center;
  gap: 6px;
}
.tk-n {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--ink-3);
}
.tk-time {
  min-width: 78px;
  text-align: right;
  font-size: var(--fs-13);
  color: var(--ink-3);
}

/* 对话 */
.detail {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.d-head {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.detail .d-head {
  padding: var(--sp-5) var(--sp-5) var(--sp-4);
  border-bottom: 1px solid var(--line);
}
.msgs {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  padding: var(--sp-4) 0;
}
.detail .msgs {
  padding: var(--sp-4) var(--sp-5);
}
.msg {
  padding: var(--sp-3) var(--sp-4);
  border: 1px solid var(--line);
  border-radius: var(--r-ctl);
}
.msg.me {
  margin-left: var(--sp-8);
  background: var(--surface-2);
}
.msg.staff {
  margin-right: var(--sp-8);
}
.msg-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  margin-bottom: 4px;
  font-size: var(--fs-13);
}
.msg-text {
  overflow-wrap: anywhere;
}
.reply {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.detail .reply {
  padding: var(--sp-4) var(--sp-5) var(--sp-5);
  border-top: 1px solid var(--line);
}
.reply-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--sp-3);
}
.solved {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
}

/* 新建工单 */
.form {
  gap: var(--sp-4);
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

@media (max-width: 1099px) {
  .md {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 767px) {
  .seg {
    width: 100%;
  }
  .seg button {
    flex: 1;
    padding: 0 6px;
  }
  .cat {
    flex: 1;
    width: auto;
  }
  .tk {
    padding: var(--sp-4);
  }
  .msg.me {
    margin-left: var(--sp-5);
  }
  .msg.staff {
    margin-right: var(--sp-5);
  }
  .reply-foot .btn {
    width: 100%;
  }
  .x {
    width: 34px;
    height: 34px;
  }
}
</style>
