<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useDock, useKeyboardInset } from '../dock'
import { isMobile } from '../breakpoints'
import Icon from '../components/Icon.vue'
import Cover from '../components/Cover.vue'
import Diff from '../components/Diff.vue'
import Crown from '../components/Crown.vue'
import Rank from '../components/Rank.vue'
import ThreadRow from '../components/ThreadRow.vue'
import ChartSheet from '../components/ChartSheet.vue'
import EmptyLane from '../components/EmptyLane.vue'
import PlayerAvatar from '../components/PlayerAvatar.vue'
import TitlePlate from '../components/TitlePlate.vue'
import DanBadge from '../components/DanBadge.vue'
import { useQueryState } from '../routeState'
import { scrollBehavior } from '../motion'
import { threadById, threads, postsOf, users, sectionBySlug, songById, chartOf, scoreOf, THREAD_TYPES, fmt } from '../mock/data'
import { L, isAuthed, isReady, songTitle, toast } from '../store'

// 帖子详情（V7）。阅读栏 760px；楼层每页 20 楼，「只看楼主」、跳到楼层都写进地址（?p= ?op=1 ?f=）。
// 路由按 path 重新挂载组件，所以帖子本身在这一实例里不变。
const PER = 20
const NESTED_SHOWN = 3
// 原型：与「我的社区 · 屏蔽」里的名单一致
const BLOCKED = new Set(['uta', 'senbon'])

const route = useRoute()
const thread = threadById[route.params.id] || null
const qs = useQueryState({
  p: { type: 'number', default: 1 },
  op: { type: 'boolean', default: false },
  f: { type: 'number', default: 0 },
})

const sec = thread ? sectionBySlug[thread.section] : null
const author = thread ? users[thread.author] : null
const song = thread?.song ? songById[thread.song.id] : null
const chart = thread?.song ? chartOf(thread.song.id, thread.song.d) : null
const songLink = song ? `/songs/${song.id}?d=${thread.song.d}&from=community` : ''
const mine = computed(() => (isReady.value && thread?.song ? scoreOf(thread.song.id, thread.song.d) || null : null))

const posts = reactive((thread ? postsOf(thread.id) : []).map((p) => ({ ...p, replies: [...(p.replies || [])] })))
const first = posts[0] || null

const floors = computed(() => posts.slice(1).filter((p) => !qs.op || p.author === thread.author))
const pages = computed(() => Math.max(1, Math.ceil(floors.value.length / PER)))
const page = computed(() => Math.min(Math.max(1, Math.round(qs.p) || 1), pages.value))
const pageFloors = computed(() => floors.value.slice((page.value - 1) * PER, page.value * PER))
const replyCount = computed(() => posts.length - 1 + posts.reduce((n, p) => n + p.replies.length, 0))
const pageList = computed(() => {
  const n = pages.value
  const c = page.value
  if (n <= 7) return Array.from({ length: n }, (_, i) => i + 1)
  const out = [1]
  for (let i = Math.max(2, c - 1); i <= Math.min(n - 1, c + 1); i++) out.push(i)
  out.push(n)
  return out.flatMap((x, i) => (i && x - out[i - 1] > 1 ? ['gap' + i, x] : [x]))
})

const roleName = (r) => ({ moderator: L('版主', 'モデレーター'), admin: L('站务', '運営') })[r]
const liked = reactive(new Set())
const fav = ref(false)
const expanded = reactive(new Set())
const revealed = reactive(new Set())
function like(k) {
  if (!isAuthed.value) return toast(L('登录后可以点赞', 'ログインするといいねできます'), 'info')
  liked.has(k) ? liked.delete(k) : liked.add(k)
}

/* ---------- 楼层定位 ---------- */
const repliesEl = ref(null)
function scrollToFloor(n) {
  const el = n === 1 ? document.getElementById('floor-1') : document.getElementById(`floor-${n}`)
  el?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' })
}
function goPage(n) {
  qs.p = n
  qs.f = 0
  nextTick(() => repliesEl.value?.scrollIntoView({ behavior: 'auto', block: 'start' }))
}
function toggleOp() {
  qs.op = !qs.op
  qs.p = 1
  qs.f = 0
}
const jumpVal = ref('')
const jumpErr = ref('')
function jump() {
  const n = Math.round(Number(jumpVal.value))
  const last = posts.length
  if (!Number.isFinite(n) || n < 1 || n > last) {
    jumpErr.value = L(`没有这一楼，可以输入 1–${last}`, `その階はありません（1–${last}）`)
    return
  }
  jumpErr.value = ''
  if (n > 1) {
    const post = posts[n - 1]
    if (qs.op && post.author !== thread.author) qs.op = false
    const idx = posts.slice(1).filter((p) => !qs.op || p.author === thread.author).indexOf(post)
    qs.p = Math.floor(idx / PER) + 1
  } else qs.p = 1
  qs.f = n
  nextTick(() => scrollToFloor(n))
}
onMounted(() => {
  if (qs.f) nextTick(() => scrollToFloor(qs.f))
})

/* ---------- 回复 ---------- */
const replyTo = ref(null)
const draft = ref('')
// F1.5：手机回复框贴底；收起一行，随输入增高到 5 行后框内滚动；软键盘弹出时贴在键盘上方
const composerEl = ref(null)
const replyEl = ref(null)
useDock(composerEl)
useKeyboardInset()
function fitReply() {
  const el = replyEl.value
  if (!el) return
  if (!isMobile.value) {
    el.style.height = ''
    el.style.overflowY = ''
    return
  }
  const cs = getComputedStyle(el)
  const lh = parseFloat(cs.lineHeight) || 21
  const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth)
  const max = Math.round(lh * 5 + pad)
  el.style.height = 'auto'
  const h = Math.min(el.scrollHeight + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth), max)
  el.style.height = `${Math.max(Math.round(h), 44)}px`
  el.style.overflowY = el.scrollHeight + 2 > max ? 'auto' : 'hidden'
}
watch(draft, () => nextTick(fitReply))
watch(isMobile, () => nextTick(fitReply))
onMounted(() => nextTick(fitReply))
const trayOpen = ref(false)
const imgs = ref([])
let imgSeq = 0
const MAX_IMG = 4
function toggleTray() {
  trayOpen.value = !trayOpen.value
  if (trayOpen.value && !imgs.value.length) addImg()
}
function addImg() {
  if (imgs.value.length >= MAX_IMG) return
  imgs.value = [...imgs.value, { id: ++imgSeq }]
}
function removeImg(id) {
  imgs.value = imgs.value.filter((x) => x.id !== id)
}
function setReplyTo(p) {
  replyTo.value = p
  nextTick(() => document.getElementById('th-reply')?.focus({ preventScroll: true }))
}
let alive = true
onBeforeUnmount(() => (alive = false))
function send() {
  const text = draft.value.trim()
  if (!text) return
  const now = L('刚刚', 'たった今')
  if (replyTo.value) {
    replyTo.value.replies.push({ author: 'mochidon', ago: now, text })
    expanded.add(replyTo.value.floor)
  } else {
    const floor = posts.length + 1
    posts.push({ floor, author: 'mochidon', ago: now, likes: 0, blocks: [{ p: text }], replies: [], imgs: imgs.value.length })
    qs.op = false
    nextTick(() => {
      if (!alive) return
      qs.p = Math.ceil((posts.length - 1) / PER)
      qs.f = floor
      nextTick(() => alive && scrollToFloor(floor))
    })
  }
  draft.value = ''
  replyTo.value = null
  imgs.value = []
  trayOpen.value = false
  toast(L('已回复', '返信しました'))
}

const related = (() => {
  if (!thread) return []
  const out = []
  const seen = new Set([thread.id])
  for (const t of threads) {
    if (out.length >= 3) break
    if (t.section === thread.section && !seen.has(t.id)) (out.push(t), seen.add(t.id))
  }
  for (const t of threads) {
    if (out.length >= 3) break
    if (t.type === 'guide' && !seen.has(t.id)) (out.push(t), seen.add(t.id))
  }
  return out
})()
</script>

<template>
  <div class="page th">
    <EmptyLane v-if="!thread" :title="L('没有找到这个帖子', 'この投稿は見つかりません')" :text="L('帖子可能已被删除，或者链接不完整。', '削除されたか、リンクが正しくない可能性があります。')">
      <RouterLink to="/community" class="btn btn-primary">{{ L('回到社区广场', 'コミュニティへ') }}</RouterLink>
    </EmptyLane>

    <div v-else class="cols">
      <article class="main">
        <header>
          <div class="row-wrap meta">
            <RouterLink :to="{ path: '/community', query: { section: thread.section } }" class="sec"><i class="dot" :style="{ color: sec.color }" />{{ L(sec.zh, sec.ja) }}</RouterLink>
            <span v-if="thread.pinned" class="tag tag-don"><Icon name="pin" :size="12" />{{ L('置顶', '固定') }}</span>
            <span v-if="thread.featured" class="tag tag-roll">{{ L('精华', '注目') }}</span>
            <span class="tag">{{ L(THREAD_TYPES[thread.type].zh, THREAD_TYPES[thread.type].ja) }}</span>
            <span v-for="t in thread.tags" :key="t" class="tag">{{ t }}</span>
          </div>
          <h1 class="title title-wrap">{{ thread.title }}</h1>
          <div class="byline">
            <PlayerAvatar :user="author" :size="44" />
            <div class="grow by-text">
              <div class="by-line">
                <RouterLink :to="`/u/${thread.author}`" class="name">{{ author.name }}</RouterLink>
                <span v-if="author.role !== 'user'" class="role" :class="author.role">{{ roleName(author.role) }}</span>
                <DanBadge :dan="author.dan" />
              </div>
              <div class="by-line">
                <TitlePlate :text="author.title" :game="author.gameTitle ?? null" :site="author.siteTitle" form="plate" />
                <span class="t-caption">{{ first?.ago || thread.ago }}</span>
              </div>
            </div>
            <span class="t-caption views only-desktop"><b class="num">{{ fmt(thread.views) }}</b> {{ L('次浏览', '閲覧') }}</span>
          </div>
        </header>

        <!-- 手机：关联谱面放在正文前 -->
        <RouterLink v-if="song" :to="songLink" class="linked only-mobile">
          <Cover :song="song" />
          <span class="grow">
            <span class="title-1l lk-t" :title="songTitle(song)">{{ songTitle(song) }}</span>
            <span v-if="mine" class="lk-mine"><Crown :v="mine.crown" size="sm" /><b class="num">{{ fmt(mine.score) }}</b></span>
          </span>
          <Diff :d="thread.song.d" :star="chart?.star" :constant="chart?.constant" short />
        </RouterLink>

        <template v-if="page === 1 && first">
          <div id="floor-1" class="body prose">
            <template v-for="(b, i) in first.blocks" :key="i">
              <p v-if="b.p">{{ b.p }}</p>
              <ul v-else-if="b.list"><li v-for="x in b.list" :key="x">{{ x }}</li></ul>
              <figure v-else-if="b.img">
                <ChartSheet v-if="song" :seed="song.id * 41" :rows="2" :start="41" :density="[0.9, 0.95, 0.85, 0.9, 0.92, 0.88, 0.95, 0.9]" :label="b.img" />
                <div v-else class="imgph" role="img" :aria-label="b.img"><Icon name="image" :size="28" /></div>
                <figcaption class="t-caption">{{ b.img }}</figcaption>
              </figure>
            </template>
          </div>

          <div class="actions">
            <button type="button" class="act" :aria-pressed="liked.has('t')" @click="like('t')"><Icon name="heart" :size="18" /><b class="num">{{ fmt(thread.likes + (liked.has('t') ? 1 : 0)) }}</b><span class="sr-only">{{ L('赞', 'いいね') }}</span></button>
            <button type="button" class="act" :aria-pressed="fav" @click="fav = !fav"><Icon name="bookmark" :size="18" />{{ fav ? L('已收藏', '保存済み') : L('收藏', '保存') }}</button>
            <button type="button" class="act" @click="toast(L('链接已复制', 'リンクをコピーしました'))"><Icon name="link" :size="18" />{{ L('复制链接', 'リンクをコピー') }}</button>
            <span class="grow" />
            <button type="button" class="act quiet">{{ L('举报', '通報') }}</button>
          </div>
        </template>

        <section ref="repliesEl" class="replies" aria-labelledby="th-replies-h">
          <h2 id="th-replies-h" class="t-h2"><span class="num">{{ fmt(replyCount) }}</span> {{ L('条回复', '件の返信') }}</h2>

          <div class="tools">
            <button type="button" class="chip" :aria-pressed="qs.op" @click="toggleOp"><Icon name="user" :size="14" />{{ L('只看楼主', '投稿者のみ') }}</button>
            <form class="jump" novalidate @submit.prevent="jump">
              <label for="th-jump" class="jl">{{ L('跳到楼层', '階へ移動') }}</label>
              <input id="th-jump" v-model="jumpVal" class="input jin num" type="number" inputmode="numeric" min="1" :max="posts.length" :placeholder="`1–${posts.length}`" :aria-invalid="!!jumpErr" :aria-describedby="jumpErr ? 'th-jump-err' : undefined" />
              <button type="submit" class="btn btn-sm">{{ L('前往', '移動') }}</button>
            </form>
          </div>
          <p v-if="jumpErr" id="th-jump-err" class="field-error" role="alert">{{ jumpErr }}</p>

          <nav v-if="pages > 1" class="pager" :aria-label="L('楼层分页', 'ページ送り')">
            <button type="button" class="btn btn-sm" :disabled="page <= 1" @click="goPage(page - 1)"><Icon name="chevL" :size="14" />{{ L('上一页', '前へ') }}</button>
            <template v-for="x in pageList" :key="x">
              <span v-if="typeof x === 'string'" class="gap" aria-hidden="true">…</span>
              <button v-else type="button" class="pg num hit" :aria-current="x === page ? 'page' : undefined" :aria-label="L(`第 ${x} 页`, `${x} ページ`)" @click="goPage(x)">{{ x }}</button>
            </template>
            <button type="button" class="btn btn-sm" :disabled="page >= pages" @click="goPage(page + 1)">{{ L('下一页', '次へ') }}<Icon name="chevR" :size="14" /></button>
          </nav>

          <ol v-if="pageFloors.length" class="floors">
            <li v-for="p in pageFloors" :id="`floor-${p.floor}`" :key="p.floor" class="post" :class="{ hl: qs.f === p.floor }">
              <div v-if="BLOCKED.has(p.author) && !revealed.has(p.floor)" class="blocked">
                <Icon name="eye" :size="16" />
                <span class="grow">{{ L('已屏蔽该用户的回复', 'ブロック中のユーザーの返信') }}</span>
                <button type="button" class="btn btn-ghost btn-sm" @click="revealed.add(p.floor)">{{ L('显示', '表示') }}</button>
                <span class="floor num">#{{ p.floor }}</span>
              </div>
              <template v-else>
                <PlayerAvatar :user="users[p.author]" :size="32" />
                <div class="grow">
                  <div class="phead">
                    <RouterLink :to="`/u/${p.author}`" class="name">{{ users[p.author].name }}</RouterLink>
                    <span v-if="users[p.author].role !== 'user'" class="role" :class="users[p.author].role">{{ roleName(users[p.author].role) }}</span>
                    <span v-if="p.author === thread.author" class="tag tag-info">{{ L('楼主', '投稿者') }}</span>
                    <DanBadge :dan="users[p.author].dan" />
                    <TitlePlate class="only-desktop" :text="users[p.author].title" :game="users[p.author].gameTitle ?? null" :site="users[p.author].siteTitle" form="text" />
                    <span class="t-caption ago">{{ p.ago }}</span>
                    <span class="floor num">#{{ p.floor }}</span>
                  </div>
                  <div class="prose ptext">
                    <template v-for="(b, i) in p.blocks" :key="i">
                      <p v-if="b.p">{{ b.p }}</p>
                      <ul v-else-if="b.list"><li v-for="x in b.list" :key="x">{{ x }}</li></ul>
                      <figure v-else-if="b.img">
                        <div class="imgph" role="img" :aria-label="b.img"><Icon name="image" :size="28" /></div>
                        <figcaption class="t-caption">{{ b.img }}</figcaption>
                      </figure>
                    </template>
                    <div v-if="p.imgs" class="pimgs">
                      <span v-for="k in p.imgs" :key="k" class="imgph sm" role="img" :aria-label="L(`图片 ${k}`, `画像 ${k}`)"><Icon name="image" :size="18" /></span>
                    </div>
                  </div>
                  <div class="pacts">
                    <button type="button" class="mini hit" :aria-pressed="liked.has(p.floor)" @click="like(p.floor)"><Icon name="heart" :size="14" /><span class="num">{{ p.likes + (liked.has(p.floor) ? 1 : 0) }}</span><span class="sr-only">{{ L('赞', 'いいね') }}</span></button>
                    <button type="button" class="mini hit" :disabled="!isAuthed" @click="setReplyTo(p)"><Icon name="reply" :size="14" />{{ L('回复', '返信') }}</button>
                  </div>
                  <template v-if="p.replies.length">
                    <ul :id="`nested-${p.floor}`" class="nested">
                      <li v-for="(r, i) in expanded.has(p.floor) ? p.replies : p.replies.slice(0, NESTED_SHOWN)" :key="i">
                        <PlayerAvatar :user="users[r.author]" :size="24" />
                        <div class="grow">
                          <RouterLink :to="`/u/${r.author}`" class="nname">{{ users[r.author].name }}</RouterLink>
                          <span v-if="r.author === thread.author" class="tag tag-info">{{ L('楼主', '投稿者') }}</span>
                          <span class="ntext">{{ r.text }}</span>
                          <span class="t-caption">{{ r.ago }}</span>
                        </div>
                      </li>
                    </ul>
                    <button v-if="p.replies.length > NESTED_SHOWN" type="button" class="morebtn hit" :aria-expanded="expanded.has(p.floor)" :aria-controls="`nested-${p.floor}`" @click="expanded.has(p.floor) ? expanded.delete(p.floor) : expanded.add(p.floor)">
                      <template v-if="expanded.has(p.floor)">{{ L('收起', '折りたたむ') }}<Icon name="chevU" :size="14" /></template>
                      <template v-else>{{ L(`展开其余 ${p.replies.length - NESTED_SHOWN} 条`, `残り ${p.replies.length - NESTED_SHOWN} 件を表示`) }}<Icon name="chevD" :size="14" /></template>
                    </button>
                  </template>
                </div>
              </template>
            </li>
          </ol>
          <p v-else class="t-small none">{{ qs.op ? L('楼主还没有在楼下回复。', '投稿者の返信はまだありません。') : L('还没有回复，来写第一条。', 'まだ返信はありません。') }}</p>

          <nav v-if="pages > 1" class="pager pager-bottom" :aria-label="L('楼层分页（底部）', 'ページ送り（下）')">
            <button type="button" class="btn btn-sm" :disabled="page <= 1" @click="goPage(page - 1)"><Icon name="chevL" :size="14" />{{ L('上一页', '前へ') }}</button>
            <template v-for="x in pageList" :key="x">
              <span v-if="typeof x === 'string'" class="gap" aria-hidden="true">…</span>
              <button v-else type="button" class="pg num hit" :aria-current="x === page ? 'page' : undefined" :aria-label="L(`第 ${x} 页`, `${x} ページ`)" @click="goPage(x)">{{ x }}</button>
            </template>
            <button type="button" class="btn btn-sm" :disabled="page >= pages" @click="goPage(page + 1)">{{ L('下一页', '次へ') }}<Icon name="chevR" :size="14" /></button>
          </nav>
        </section>

        <form ref="composerEl" class="composer" @submit.prevent="send">
          <div v-if="replyTo" class="replying">
            <span>{{ L('回复', '返信先：') }} #{{ replyTo.floor }} {{ users[replyTo.author].name }}</span>
            <button type="button" class="icon-btn" :aria-label="L('取消回复', '返信をやめる')" @click="replyTo = null"><Icon name="close" :size="14" /></button>
          </div>
          <div v-if="trayOpen" class="tray" role="group" :aria-label="L('要发送的图片', '添付する画像')">
            <span v-for="(im, i) in imgs" :key="im.id" class="tile">
              <Icon name="image" :size="18" />
              <span class="t-caption">{{ L(`图片 ${i + 1}`, `画像 ${i + 1}`) }}</span>
              <button type="button" class="tile-rm hit" :aria-label="L(`移除图片 ${i + 1}`, `画像 ${i + 1} を削除`)" @click="removeImg(im.id)"><Icon name="close" :size="12" /></button>
            </span>
            <button v-if="imgs.length < MAX_IMG" type="button" class="tile add" @click="addImg"><Icon name="plus" :size="16" /><span class="t-caption">{{ L('添加', '追加') }}</span></button>
            <span class="t-caption tray-n num">{{ imgs.length }} / {{ MAX_IMG }}</span>
          </div>
          <div class="crow">
            <label for="th-reply" class="sr-only">{{ L('回复内容', '返信の内容') }}</label>
            <textarea id="th-reply" ref="replyEl" v-model="draft" class="textarea" :rows="isMobile ? 1 : 2" :disabled="!isAuthed" :placeholder="isAuthed ? L('写下你的回复', '返信を書く') : L('登录后参与讨论', 'ログインして返信')" />
            <div class="cbtns">
              <button type="button" class="icon-btn" :aria-label="L('添加图片（最多 4 张）', '画像を追加（4 枚まで）')" :aria-expanded="trayOpen" :disabled="!isAuthed" @click="toggleTray"><Icon name="image" /></button>
              <button v-if="isAuthed" type="submit" class="btn btn-primary" :disabled="!draft.trim()">{{ L('回复', '返信する') }}</button>
              <RouterLink v-else to="/login" class="btn btn-primary">{{ L('登录', 'ログイン') }}</RouterLink>
            </div>
          </div>
        </form>
      </article>

      <aside class="side">
        <section v-if="song" class="panel chartcard">
          <h2 class="t-h3">{{ L('这帖讨论的谱面', 'このスレッドの譜面') }}</h2>
          <RouterLink :to="songLink" class="cc-song">
            <Cover :song="song" size="lg" />
            <span class="grow"><b class="title-wrap-2" :title="songTitle(song)">{{ songTitle(song) }}</b><Diff :d="thread.song.d" :star="chart?.star" :constant="chart?.constant" show-missing /></span>
          </RouterLink>
          <div v-if="isReady" class="mine">
            <span class="t-caption">{{ L('我的最好成绩', '自己ベスト') }}</span>
            <template v-if="mine">
              <div class="row"><Crown :v="mine.crown" /><b class="num sc">{{ fmt(mine.score) }}</b><Rank :v="mine.rank" named /></div>
              <div class="judge" aria-hidden="true"><i class="g" :style="{ flex: mine.good }" /><i class="o" :style="{ flex: mine.ok }" /><i class="n" :style="{ flex: mine.ng }" /></div>
              <span class="t-caption num">{{ L('良', '良') }} {{ mine.good }} · {{ L('可', '可') }} {{ mine.ok }} · {{ L('不可', '不可') }} {{ mine.ng }}</span>
            </template>
            <div v-else class="row"><span class="na sc">—</span><span class="t-small">{{ L('还没打过这张谱', 'まだプレイしていません') }}</span></div>
          </div>
          <RouterLink :to="songLink" class="btn btn-block">{{ L('查看谱面与数据', '譜面とデータを見る') }}</RouterLink>
        </section>
        <section v-if="related.length">
          <div class="section-head"><h2 class="t-h3">{{ L('相关帖子', '関連スレッド') }}</h2></div>
          <div class="ruled"><ThreadRow v-for="t in related" :key="t.id" :thread="t" compact /></div>
        </section>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.cols {
  display: grid;
  grid-template-columns: minmax(0, 760px) 320px;
  justify-content: center;
  gap: 56px;
  align-items: start;
}
.main {
  min-width: 0;
}
.meta {
  font-size: var(--fs-13);
}
.sec {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
  margin-right: 4px;
}
.sec:hover {
  color: var(--link);
}
.title {
  margin: 12px 0 18px;
  font-size: clamp(1.375rem, 2.2vw, 1.75rem);
  font-weight: 900;
  line-height: 1.4;
}
.byline {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--line);
}
.by-text {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.by-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 8px;
  min-width: 0;
}
.name {
  font-weight: 700;
}
.name:hover,
.nname:hover {
  color: var(--link);
}
.views {
  white-space: nowrap;
}

/* 阅读排版：16px / 1.85，阅读栏 760px */
.prose {
  max-width: 760px;
  font-size: var(--fs-16);
  line-height: 1.85;
  overflow-wrap: anywhere;
}
.prose > * + * {
  margin-top: 1.1em;
}
.prose ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.prose li {
  position: relative;
  padding-left: 22px;
}
.prose li::before {
  content: '';
  position: absolute;
  left: 2px;
  top: 0.62em;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: inset 0 0 0 2px var(--note-ring), 0 0 0 1px var(--note-outline);
}
.prose figure {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.body {
  padding: 24px 0 8px;
  scroll-margin-top: calc(var(--bar-h) + 16px);
}
.imgph {
  display: grid;
  place-items: center;
  height: 180px;
  border: 1px dashed var(--line-strong);
  border-radius: var(--r-panel);
  background: var(--surface-2);
  color: var(--ink-3);
}
.imgph.sm {
  width: 72px;
  height: 72px;
  border-radius: var(--r-ctl);
}
.pimgs {
  display: flex;
  gap: 8px;
}
.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 0;
  border-bottom: 1px solid var(--line);
}
.act {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: var(--ctl-h);
  padding: 0 14px;
  border-radius: var(--r-note);
  border: 1px solid var(--line-strong);
  font-size: var(--fs-13);
  font-weight: 500;
  color: var(--ink-2);
  white-space: nowrap;
}
.act:hover {
  border-color: var(--ink-3);
  color: var(--ink);
}
.act b {
  font-size: var(--fs-16);
}
.act[aria-pressed='true'] {
  background: var(--vote-on-wash);
  border-color: var(--vote-on);
  color: var(--vote-on-ink);
}
.act.quiet {
  border-color: transparent;
  color: var(--ink-3);
}
.replies {
  margin-top: 32px;
  scroll-margin-top: calc(var(--bar-h) + 16px);
}
.tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 16px;
  margin-top: 14px;
}
.jump {
  display: flex;
  align-items: center;
  gap: 8px;
}
.jl {
  font-size: var(--fs-13);
  color: var(--ink-2);
  white-space: nowrap;
}
.jin {
  width: 96px;
  height: var(--ctl-h-sm);
}
.pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 14px;
  padding-bottom: 6px;
}
.pager-bottom {
  margin: 8px 0 12px;
  padding-top: 14px;
}
.pg {
  min-width: 32px;
  height: 32px;
  padding: 0 6px;
  border-radius: var(--ctl-radius);
  font-size: var(--fs-14);
  color: var(--ink-2);
}
.pg:hover {
  background: var(--bg-sunk);
  color: var(--ink);
}
.pg[aria-current='page'] {
  background: var(--nav-active-bg);
  color: var(--nav-active-ink);
}
.gap {
  padding: 0 2px;
  color: var(--ink-3);
}
.floors {
  margin-top: 4px;
  border-top: 1px solid var(--line);
}
.post {
  display: flex;
  gap: 14px;
  padding: 18px 0;
  border-bottom: 1px solid var(--line);
  scroll-margin-top: calc(var(--bar-h) + 16px);
  scroll-margin-bottom: 160px;
}
.post.hl {
  margin: 0 -12px;
  padding-left: 12px;
  padding-right: 12px;
  background: var(--row-sel-bg);
  box-shadow: inset 3px 0 0 var(--row-sel-line);
}
.phead {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 8px;
}
.ago {
  white-space: nowrap;
}
.floor {
  margin-left: auto;
  color: var(--ink-3);
  font-size: var(--fs-13);
}
.ptext {
  margin-top: 8px;
}
.pacts {
  display: flex;
  gap: 8px;
  margin: 8px 0 0 -8px;
}
.mini {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 30px;
  padding: 0 8px;
  border-radius: var(--r-ctl);
  font-size: var(--fs-12);
  color: var(--ink-2);
}
.mini:hover {
  background: var(--bg-sunk);
  color: var(--ink);
}
.mini[aria-pressed='true'] {
  color: var(--vote-on-ink);
  font-weight: 700;
}
.nested {
  margin-top: 10px;
  padding: 4px 14px;
  border-left: 2px solid var(--line-strong);
}
.nested li {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 7px 0;
  font-size: var(--fs-14);
  line-height: 1.7;
}
.nname {
  font-weight: 700;
  margin-right: 6px;
}
.nested .tag {
  margin-right: 6px;
}
.ntext {
  margin-right: 8px;
  color: var(--ink);
  overflow-wrap: anywhere;
}
.morebtn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin: 4px 0 0 16px;
  font-size: var(--fs-13);
  font-weight: 500;
  color: var(--link);
}
.morebtn:hover {
  text-decoration: underline;
}
.blocked {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.none {
  padding: 18px 0;
}
.composer {
  position: sticky;
  bottom: 0;
  z-index: 2;
  margin-top: 20px;
  padding: 12px 0 16px;
  background: var(--bg);
  border-top: 1px solid var(--line-strong);
}
.replying {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--fs-12);
  color: var(--link);
  font-weight: 500;
}
.tray {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.tile {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 64px;
  height: 64px;
  border: 1px dashed var(--line-strong);
  border-radius: var(--r-ctl);
  background: var(--surface-2);
  color: var(--ink-2);
}
.tile.add:hover {
  border-color: var(--ink-2);
  color: var(--ink);
}
.tile-rm {
  position: absolute;
  top: -8px;
  right: -8px;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--ink);
  color: var(--bg);
}
.tray-n {
  margin-left: 4px;
}
.crow {
  display: flex;
  gap: 10px;
  align-items: flex-end;
}
.crow .textarea {
  flex: 1;
  min-width: 0;
}
.cbtns {
  display: flex;
  gap: 6px;
  align-items: center;
}
.side {
  position: sticky;
  top: calc(var(--bar-h) + 24px);
  display: flex;
  flex-direction: column;
  gap: 28px;
}
.chartcard {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px 20px 20px;
}
.cc-song {
  display: flex;
  gap: 14px;
  align-items: center;
}
.cc-song .grow {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}
.cc-song b {
  font-size: var(--fs-16);
  line-height: 1.35;
}
.cc-song:hover b {
  color: var(--link);
}
.mine {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
}
.sc {
  flex: 1;
  font-size: var(--fs-28);
  line-height: 1;
}
.ruled {
  border-top: 1px solid var(--line-strong);
}
.linked {
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  margin-top: 16px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
}
.lk-t {
  font-weight: 700;
}
.lk-mine {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
  font-size: var(--fs-13);
  color: var(--ink-2);
}
@media (max-width: 1099px) {
  .cols {
    grid-template-columns: minmax(0, 760px);
  }
  .side {
    display: none;
  }
}
@media (max-width: 767px) {
  .title {
    margin: 10px 0 14px;
  }
  .byline {
    padding-bottom: 14px;
  }
  .body {
    padding-top: 16px;
  }
  .actions {
    overflow-x: auto;
  }
  .act {
    height: var(--hit);
  }
  .act.quiet {
    display: none;
  }
  .linked {
    display: flex !important;
  }
  .post {
    gap: 10px;
    scroll-margin-bottom: 200px;
  }
  .post.hl {
    margin: 0 calc(var(--gutter) * -1);
    padding-left: var(--gutter);
    padding-right: var(--gutter);
  }
  .tools {
    align-items: stretch;
  }
  .jump {
    flex: 1;
  }
  .jin {
    flex: 1;
    width: auto;
    height: var(--hit);
  }
  .pager {
    gap: 8px;
  }
  /* 吸底回复框在底栏之上；底部分页留出它的高度，滚到最后时不被遮住 */
  .pager-bottom {
    margin-bottom: 20px;
  }
  /* F1.5：回复框贴底（此页没有底栏），内部用安全区做下内边距；软键盘弹出时贴在键盘上方，不再叠加安全区 */
  .composer {
    position: fixed;
    left: 0;
    right: 0;
    bottom: calc(var(--shell-bottom) - env(safe-area-inset-bottom, 0px));
    z-index: var(--z-bar);
    margin: 0;
    padding: 8px var(--gutter) calc(8px + env(safe-area-inset-bottom, 0px));
    background: color-mix(in srgb, var(--bg) 94%, transparent);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
  }
  :global(:root[data-kb]) .composer {
    bottom: var(--kb-h);
    padding-bottom: 8px;
  }
  .crow {
    align-items: flex-end;
  }
  /* 一行 = 26px 行高 + 上下 8px + 边框 = 44px；最多 5 行 */
  .composer .textarea {
    min-height: var(--hit);
    padding-top: 8px;
    padding-bottom: 8px;
    line-height: 26px;
    resize: none;
    overflow-y: hidden;
  }
  .cbtns .icon-btn,
  .cbtns .btn {
    min-width: var(--hit);
    height: var(--hit);
  }
  .tile-rm {
    width: 26px;
    height: 26px;
  }
}
/* D7：手机上页码钮的可点宽度也到 --hit（页码之间不再靠扩展区，直接给最小宽度） */
@media (max-width: 767px) {
  .pg {
    min-width: var(--hit);
  }
}
</style>
