<script setup>
import { computed, reactive, ref, watch } from 'vue'
import Icon from '../components/Icon.vue'
import EmptyLane from '../components/EmptyLane.vue'
import ThreadRow from '../components/ThreadRow.vue'
import { player, threads, threadById, users, fmt } from '../mock/data'
import { store, L, toast } from '../store'

/* 本页演示数据（mock 里没有「我」发的帖子，这里借几条并改写作者） */
const myThreads = [3996, 4009, 3984].map((id) => ({ ...threadById[id], author: 'mochidon' }))
const myReplies = [
  { id: 1, thread: 4017, ago: '昨天 21:40', likes: 24, text: '太及时了，我现在就卡在这里，不可从 7 压到 3 之后一直下不去。回去试试左起。' },
  { id: 2, thread: 4017, ago: '昨天 22:03', likes: 3, text: '好，周末去机厅试，成功了回来报告。', quote: { who: 'hayate', text: '不可 3 的话基本就是第三组起手的问题，左起应该能直接解决。' } },
  { id: 3, thread: 4001, ago: '3 天前', likes: 11, text: '大悦城那台周末排队大概四十分钟，工作日晚上基本不用等。', quote: { who: 'kumo', text: '更新了三家店的鼓面灵敏度和排队情况。大悦城那台右咔已经修好了。' } },
  { id: 4, thread: 3996, ago: '4 天前', likes: 42, text: '千本桜里，31 次，昨天刚全良。' },
]
const favorites = [4017, 4006, 4012].map((id) => threadById[id])
const history = ref([4021, 4017, 4012, 4009, 4001].map((id) => threadById[id]))
const following = ref(['hayate', 'rin', 'nagi'])
const blocked = ref(['uta'])

const likes = myThreads.reduce((n, t) => n + t.likes, 0) + myReplies.reduce((n, r) => n + r.likes, 0)
const counts = computed(() => [
  { k: L('帖子', '投稿'), v: myThreads.length },
  { k: L('回复', '返信'), v: myReplies.length },
  { k: L('获赞', 'いいね'), v: fmt(likes) },
  { k: L('收藏', 'ブックマーク'), v: favorites.length },
])

const TABS = [
  { key: 'threads', zh: '我的帖子', ja: '自分の投稿' },
  { key: 'replies', zh: '我的回复', ja: '自分の返信' },
  { key: 'favorites', zh: '收藏', ja: 'ブックマーク' },
  { key: 'history', zh: '浏览历史', ja: '閲覧履歴' },
  { key: 'people', zh: '关注与屏蔽', ja: 'フォロー・ブロック' },
]
const tab = ref('threads')
const ROLE = { moderator: { zh: '版主', ja: 'モデレーター' }, admin: { zh: '管理员', ja: '管理者' } }
const hue = (u) => ({ background: `hsl(${users[u].hue} 45% 42%)` })

function clearHistory() {
  history.value = []
  toast(L('浏览历史已清空', '閲覧履歴を消去しました'))
}
function unfollow(u) {
  following.value = following.value.filter((x) => x !== u)
  toast(L(`已取消关注 ${users[u].name}`, `${users[u].name} のフォローを解除しました`))
}
function unblock(u) {
  blocked.value = blocked.value.filter((x) => x !== u)
  toast(L(`已解除对 ${users[u].name} 的屏蔽`, `${users[u].name} のブロックを解除しました`))
}

/* 站务操作（版主预览） */
const asMod = ref(false)
const modOpen = ref(false)
const modThread = ref(threads[1].id)
const modState = reactive(Object.fromEntries(threads.map((t) => [t.id, { pinned: !!t.pinned, featured: !!t.featured, locked: false, hidden: false }])))
const ACTIONS = [
  { key: 'pinned', zh: '置顶', ja: '固定', offZh: '取消置顶', offJa: '固定を解除', onZh: '已置顶', onJa: '固定中' },
  { key: 'featured', zh: '加精', ja: '注目に設定', offZh: '取消加精', offJa: '注目を解除', onZh: '已加精', onJa: '注目中' },
  { key: 'locked', zh: '锁帖', ja: 'ロック', offZh: '解除锁定', offJa: 'ロックを解除', onZh: '已锁定', onJa: 'ロック中' },
  { key: 'hidden', zh: '隐藏', ja: '非表示', offZh: '恢复显示', offJa: '再表示', onZh: '已隐藏', onJa: '非表示中' },
]
const reasons = reactive({ pinned: '', featured: '', locked: '', hidden: '' })
const reasonErr = reactive({ pinned: '', featured: '', locked: '', hidden: '' })
const cur = computed(() => modState[modThread.value])
watch(modThread, () => {
  for (const k in reasons) {
    reasons[k] = ''
    reasonErr[k] = ''
  }
})
function act(a) {
  if (reasons[a.key].trim().length < 4) {
    reasonErr[a.key] = L('请填写操作理由（至少 4 个字）。理由会记入站务日志，并通知发帖人。', '理由を 4 文字以上で入力してください。運営ログに記録され、投稿者に通知されます。')
    document.getElementById(`mod-${a.key}`)?.focus()
    return
  }
  const on = !cur.value[a.key]
  cur.value[a.key] = on
  reasons[a.key] = ''
  reasonErr[a.key] = ''
  toast(L(`${on ? a.onZh : `已${a.offZh}`}，理由已记入站务日志`, `${on ? a.ja : a.offJa}：理由を運営ログに記録しました`))
}
</script>

<template>
  <div class="page">
    <EmptyLane v-if="store.auth === 'guest'" :title="L('登录后查看我的社区', 'ログインしてマイ投稿を見る')" :text="L('你的帖子、回复、收藏和关注都在这里。', '投稿・返信・ブックマーク・フォローがここにまとまります。')">
      <RouterLink to="/login" class="btn btn-primary">{{ L('登录', 'ログイン') }}</RouterLink>
      <RouterLink to="/login?mode=register" class="btn">{{ L('注册', '新規登録') }}</RouterLink>
    </EmptyLane>

    <template v-else>
      <header class="me-head">
        <span class="avatar lg" style="background: var(--don)">{{ player.nickname[0] }}</span>
        <div class="who">
          <h1 class="t-h1 row-wrap">
            {{ player.nickname }}
            <span v-if="asMod" class="role moderator">{{ L(ROLE.moderator.zh, ROLE.moderator.ja) }}</span>
          </h1>
          <p class="t-small row-wrap">
            <span class="tag tag-roll">{{ player.title }}</span>
            <span>{{ player.dan }}</span>
            <span class="faint">CN <span class="num">{{ player.taikoIdMasked }}</span></span>
          </p>
        </div>
        <dl class="counts">
          <div v-for="c in counts" :key="c.k" class="stat">
            <dt class="k">{{ c.k }}</dt>
            <dd class="v">{{ c.v }}</dd>
          </div>
        </dl>
      </header>

      <div class="tabs" role="tablist" :aria-label="L('我的社区', 'マイ投稿')">
        <button v-for="t in TABS" :id="`me-tab-${t.key}`" :key="t.key" type="button" role="tab" :aria-selected="tab === t.key" aria-controls="me-panel" @click="tab = t.key">{{ L(t.zh, t.ja) }}</button>
      </div>

      <div id="me-panel" class="tabpanel" role="tabpanel" :aria-labelledby="`me-tab-${tab}`">
        <!-- 我的帖子 -->
        <div v-if="tab === 'threads'" class="ruled">
          <ThreadRow v-for="t in myThreads" :key="t.id" :thread="t" />
        </div>

        <!-- 我的回复 -->
        <ul v-else-if="tab === 'replies'" class="ruled">
          <li v-for="r in myReplies" :key="r.id">
            <RouterLink :to="`/community/t/${r.thread}`" class="reply">
              <p class="t-caption truncate">{{ L('回复于', '返信先：') }}「{{ threadById[r.thread].title }}」</p>
              <blockquote v-if="r.quote"><b>{{ users[r.quote.who].name }}</b>{{ r.quote.text }}</blockquote>
              <p class="reply-text">{{ r.text }}</p>
              <p class="reply-foot"><span>{{ r.ago }}</span><span class="row" style="gap: 4px"><Icon name="heart" :size="14" /><b class="num">{{ r.likes }}</b></span></p>
            </RouterLink>
          </li>
        </ul>

        <!-- 收藏 -->
        <div v-else-if="tab === 'favorites'" class="ruled">
          <ThreadRow v-for="t in favorites" :key="t.id" :thread="t" />
        </div>

        <!-- 浏览历史 -->
        <template v-else-if="tab === 'history'">
          <template v-if="history.length">
            <div class="spread sub-head">
              <span class="t-small"><span class="num">{{ history.length }}</span> {{ L('条，只有你能看到', '件（自分だけに表示）') }}</span>
              <button type="button" class="btn btn-ghost btn-sm" @click="clearHistory"><Icon name="trash" :size="16" />{{ L('清空浏览历史', '履歴を消去') }}</button>
            </div>
            <div class="ruled">
              <ThreadRow v-for="t in history" :key="t.id" :thread="t" compact />
            </div>
          </template>
          <EmptyLane v-else compact :title="L('没有浏览记录', '閲覧履歴はありません')" :text="L('看过的帖子会留在这里，方便回头找。', '閲覧した投稿がここに残ります。')">
            <RouterLink to="/community" class="btn">{{ L('去广场看看', '広場へ') }}</RouterLink>
          </EmptyLane>
        </template>

        <!-- 关注与屏蔽 -->
        <div v-else class="people">
          <section>
            <h2 class="t-h3">{{ L('关注', 'フォロー中') }} <span class="num faint">{{ following.length }}</span></h2>
            <ul v-if="following.length" class="ruled">
              <li v-for="u in following" :key="u" class="urow">
                <RouterLink :to="`/u/${u}`" class="uwho">
                  <span class="avatar" :style="hue(u)">{{ users[u].name[0] }}</span>
                  <span class="grow">
                    <span class="uname"><b class="truncate">{{ users[u].name }}</b><span v-if="ROLE[users[u].role]" class="role" :class="users[u].role">{{ L(ROLE[users[u].role].zh, ROLE[users[u].role].ja) }}</span></span>
                    <span class="t-caption">{{ users[u].title }} · {{ users[u].dan }}</span>
                  </span>
                </RouterLink>
                <button type="button" class="btn btn-sm" @click="unfollow(u)">{{ L('取消关注', 'フォロー解除') }}</button>
              </li>
            </ul>
            <p v-else class="t-small none">{{ L('还没有关注任何人。', 'フォロー中のユーザーはいません。') }}</p>
          </section>
          <section>
            <h2 class="t-h3">{{ L('屏蔽', 'ブロック中') }} <span class="num faint">{{ blocked.length }}</span></h2>
            <ul v-if="blocked.length" class="ruled">
              <li v-for="u in blocked" :key="u" class="urow">
                <span class="uwho">
                  <span class="avatar" :style="hue(u)">{{ users[u].name[0] }}</span>
                  <span class="grow">
                    <span class="uname"><b class="truncate">{{ users[u].name }}</b></span>
                    <span class="t-caption">{{ L('对方的帖子和回复不会出现在你的列表里', '相手の投稿と返信は一覧に表示されません') }}</span>
                  </span>
                </span>
                <button type="button" class="btn btn-sm" @click="unblock(u)">{{ L('解除屏蔽', 'ブロック解除') }}</button>
              </li>
            </ul>
            <p v-else class="t-small none">{{ L('没有屏蔽任何人。', 'ブロック中のユーザーはいません。') }}</p>
          </section>
        </div>
      </div>

      <!-- 站务 -->
      <section class="section mod">
        <button type="button" class="chip" :aria-pressed="asMod" @click="asMod = !asMod"><Icon name="shield" :size="14" />{{ L('以版主身份预览', 'モデレーターとして表示') }}</button>

        <div v-if="asMod" class="panel mod-panel">
          <button type="button" class="mod-toggle" :aria-expanded="modOpen" aria-controls="mod-body" @click="modOpen = !modOpen">
            <span class="t-h2">{{ L('站务操作', '運営操作') }}</span>
            <Icon :name="modOpen ? 'chevU' : 'chevD'" />
          </button>
          <div v-if="modOpen" id="mod-body" class="mod-body">
            <div class="field">
              <label for="mod-thread">{{ L('操作的帖子', '対象の投稿') }}</label>
              <select id="mod-thread" v-model.number="modThread" class="select">
                <option v-for="t in threads" :key="t.id" :value="t.id">#{{ t.id }} {{ t.title }}</option>
              </select>
            </div>
            <form v-for="a in ACTIONS" :key="a.key" class="mod-row" novalidate @submit.prevent="act(a)">
              <div class="mod-name">
                <b>{{ L(a.zh, a.ja) }}</b>
                <span v-if="cur[a.key]" class="tag" :class="a.key === 'hidden' || a.key === 'locked' ? 'tag-roll' : 'tag-ok'">{{ L(a.onZh, a.onJa) }}</span>
              </div>
              <div class="field">
                <label :for="`mod-${a.key}`" class="sr-only">{{ L(`${a.zh}理由`, `${a.ja}の理由`) }}</label>
                <input :id="`mod-${a.key}`" v-model="reasons[a.key]" class="input" :class="{ 'is-error': reasonErr[a.key] }" type="text" autocomplete="off" maxlength="80" required :placeholder="L('理由（必填）', '理由（必須）')" :aria-invalid="!!reasonErr[a.key]" :aria-describedby="reasonErr[a.key] ? `mod-${a.key}-err` : undefined" />
                <p v-if="reasonErr[a.key]" :id="`mod-${a.key}-err`" class="field-error">{{ reasonErr[a.key] }}</p>
              </div>
              <button type="submit" class="btn" :class="{ 'mod-danger': a.key === 'hidden' && !cur.hidden }">{{ cur[a.key] ? L(a.offZh, a.offJa) : L(a.zh, a.ja) }}</button>
            </form>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.me-head {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px 20px;
  margin-bottom: var(--sp-6);
}
.who {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.who h1 {
  gap: 10px;
}
.counts {
  display: flex;
  gap: 36px;
}
.counts .stat {
  display: flex;
  flex-direction: column-reverse;
}
.tabpanel {
  padding-top: var(--sp-2);
}
.ruled > li {
  border-bottom: 1px solid var(--line);
}
.ruled > li:last-child {
  border-bottom: 0;
}

/* 回复：引用在上，自己的话在下 */
.reply {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 0;
}
.reply blockquote {
  margin: 0;
  padding: 2px 0 2px 12px;
  border-left: 3px solid var(--line-strong);
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.reply blockquote b {
  margin-right: 8px;
  color: var(--ink);
}
.reply-text {
  font-size: var(--fs-16);
  line-height: 1.55;
}
.reply:hover .reply-text {
  color: var(--ka-ink);
}
.reply-foot {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: var(--fs-12);
  color: var(--ink-3);
}
.reply-foot b {
  font-size: var(--fs-14);
  color: var(--ink-2);
}
.sub-head {
  padding: 8px 0 4px;
}

.people {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px 48px;
  padding-top: var(--sp-4);
}
.people h2 {
  padding-bottom: 10px;
  border-bottom: 1px solid var(--line-strong);
}
.urow {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
}
.uwho {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
}
.uwho .grow {
  display: flex;
  flex-direction: column;
}
.uname {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
a.uwho:hover b {
  color: var(--ka-ink);
}
.none {
  padding: 14px 0;
}

/* 站务 */
.mod {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}
.mod-panel {
  width: 100%;
  max-width: 880px;
}
.mod-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 14px 20px;
  border-radius: var(--r-panel);
  text-align: left;
}
.mod-body {
  display: flex;
  flex-direction: column;
  padding: 4px 20px 8px;
  border-top: 1px solid var(--line);
}
.mod-body > .field {
  padding: 16px 0;
}
.mod-row {
  display: grid;
  grid-template-columns: 132px minmax(0, 1fr) 112px;
  align-items: start;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid var(--line);
}
.mod-name {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
}
.mod-row .btn {
  height: 40px;
}
.mod-danger {
  color: var(--danger);
}

@media (max-width: 1099px) {
  .me-head {
    grid-template-columns: auto minmax(0, 1fr);
  }
  .counts {
    grid-column: 1 / -1;
    justify-content: space-between;
    gap: 12px;
    padding-top: 16px;
    border-top: 1px solid var(--line);
  }
  .counts .stat {
    flex: 1;
  }
}
@media (max-width: 767px) {
  .me-head .avatar.lg {
    width: 56px;
    height: 56px;
    font-size: var(--fs-22);
  }
  .people {
    grid-template-columns: minmax(0, 1fr);
    gap: 24px;
  }
  .reply-text {
    font-size: var(--fs-14);
  }
  .mod .chip {
    align-self: stretch;
    justify-content: center;
  }
  .mod-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }
  .mod-name {
    min-height: 0;
  }
  .mod-row .btn {
    width: 100%;
    height: 44px;
  }
}
</style>
