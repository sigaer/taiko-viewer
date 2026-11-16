<script setup>
import { computed, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import Icon from '../components/Icon.vue'
import Cover from '../components/Cover.vue'
import Diff from '../components/Diff.vue'
import Crown from '../components/Crown.vue'
import Rank from '../components/Rank.vue'
import ThreadRow from '../components/ThreadRow.vue'
import ChartSheet from '../components/ChartSheet.vue'
import { threadById, threads, threadPosts, users, sectionBySlug, songById, chartOf, scoreOf, THREAD_TYPES, fmt } from '../mock/data'
import { L, isAuthed, isReady, songTitle, toast } from '../store'

// 帖子详情。正文限制在适合阅读的行宽；关联谱面和「我在这张谱上的成绩」放在右栏，
// 让攻略帖能直接对照自己的数据。
const route = useRoute()
const thread = computed(() => threadById[route.params.id] || threads[1])
const sec = computed(() => sectionBySlug[thread.value.section])
const author = computed(() => users[thread.value.author])
const song = computed(() => (thread.value.song ? songById[thread.value.song.id] : null))
const chart = computed(() => (thread.value.song ? chartOf(thread.value.song.id, thread.value.song.d) : null))
const mine = computed(() => (isReady.value && thread.value.song ? scoreOf(thread.value.song.id, thread.value.song.d) : null))
const liked = reactive(new Set())
const fav = ref(false)
const replyTo = ref(null)
const draft = ref('')
const posts = reactive(threadPosts.map((p) => ({ ...p, replies: [...(p.replies || [])] })))
const roleName = (r) => ({ moderator: L('版主', 'モデレーター'), admin: L('站务', '運営') })[r]
function like(k) {
  if (!isAuthed.value) return toast(L('登录后可以点赞', 'ログインするといいねできます'), 'info')
  liked.has(k) ? liked.delete(k) : liked.add(k)
}
function send() {
  if (!draft.value.trim()) return
  if (replyTo.value) replyTo.value.replies.push({ author: 'mochidon', ago: L('刚刚', 'たった今'), text: draft.value })
  else posts.push({ floor: posts.length + 1, author: 'mochidon', ago: L('刚刚', 'たった今'), likes: 0, blocks: [{ p: draft.value }], replies: [] })
  draft.value = ''
  replyTo.value = null
  toast(L('已回复', '返信しました'))
}
const related = computed(() => threads.filter((t) => t.id !== thread.value.id && t.section === thread.value.section).concat(threads.filter((t) => t.type === 'guide' && t.id !== thread.value.id)).slice(0, 3))
</script>

<template>
  <div class="page th">
    <div class="cols">
      <article class="main">
        <header>
          <div class="row-wrap meta">
            <RouterLink to="/community" class="sec"><i class="dot" :style="{ color: sec.color }" />{{ L(sec.zh, sec.ja) }}</RouterLink>
            <span v-if="thread.featured" class="tag tag-roll">{{ L('精华', '注目') }}</span>
            <span class="tag">{{ L(THREAD_TYPES[thread.type].zh, THREAD_TYPES[thread.type].ja) }}</span>
            <span v-for="t in thread.tags" :key="t" class="tag">{{ t }}</span>
          </div>
          <h1 class="title">{{ thread.title }}</h1>
          <div class="byline">
            <span class="avatar" :style="{ background: `hsl(${author.hue} 45% 42%)` }">{{ author.name[0] }}</span>
            <div class="grow">
              <RouterLink :to="`/u/${thread.author}`" class="name">{{ author.name }}</RouterLink>
              <span v-if="author.role !== 'user'" class="role" :class="author.role">{{ roleName(author.role) }}</span>
              <span class="t-caption who">{{ author.title }} · {{ author.dan }} · {{ posts[0].ago }}</span>
            </div>
            <span class="t-caption only-desktop"><b class="num">{{ fmt(thread.views) }}</b> {{ L('次浏览', '閲覧') }}</span>
          </div>
        </header>

        <!-- 手机：关联谱面放在正文前 -->
        <RouterLink v-if="song" :to="`/songs/${song.id}?d=${thread.song.d}`" class="linked panel only-mobile">
          <Cover :song="song" /><span class="grow"><b class="truncate">{{ songTitle(song) }}</b></span><Diff :d="thread.song.d" :star="chart.star" :constant="chart.constant" short />
        </RouterLink>

        <div class="body">
          <template v-for="(b, i) in posts[0].blocks" :key="i">
            <p v-if="b.p">{{ b.p }}</p>
            <ul v-else-if="b.list"><li v-for="x in b.list" :key="x">{{ x }}</li></ul>
            <figure v-else-if="b.img">
              <ChartSheet :seed="615 * 41" :rows="2" :start="41" :density="[0.9, 0.95, 0.85, 0.9, 0.92, 0.88, 0.95, 0.9]" />
              <figcaption class="t-caption">{{ b.img }}</figcaption>
            </figure>
          </template>
        </div>

        <div class="actions">
          <button class="act" :aria-pressed="liked.has('t')" @click="like('t')"><Icon name="heart" :size="18" /><b class="num">{{ fmt(thread.likes + (liked.has('t') ? 1 : 0)) }}</b></button>
          <button class="act" :aria-pressed="fav" @click="fav = !fav"><Icon name="bookmark" :size="18" />{{ fav ? L('已收藏', '保存済み') : L('收藏', '保存') }}</button>
          <button class="act" @click="toast(L('链接已复制', 'リンクをコピーしました'))"><Icon name="link" :size="18" />{{ L('复制链接', 'リンクをコピー') }}</button>
          <span class="grow" />
          <button class="act quiet">{{ L('举报', '通報') }}</button>
        </div>

        <section class="replies">
          <h2 class="t-h2">{{ thread.replies }} {{ L('条回复', '件の返信') }}</h2>
          <ol>
            <li v-for="p in posts.slice(1)" :key="p.floor" class="post">
              <span class="avatar" :style="{ background: `hsl(${users[p.author].hue} 45% 42%)` }">{{ users[p.author].name[0] }}</span>
              <div class="grow">
                <div class="phead">
                  <RouterLink :to="`/u/${p.author}`" class="name">{{ users[p.author].name }}</RouterLink>
                  <span v-if="users[p.author].role !== 'user'" class="role" :class="users[p.author].role">{{ roleName(users[p.author].role) }}</span>
                  <span v-if="p.author === thread.author" class="tag">{{ L('楼主', '投稿者') }}</span>
                  <span class="t-caption">{{ users[p.author].dan }} · {{ p.ago }}</span>
                  <span class="floor num">#{{ p.floor }}</span>
                </div>
                <p v-for="(b, i) in p.blocks" :key="i" class="ptext">{{ b.p }}</p>
                <div class="pacts">
                  <button class="mini" :aria-pressed="liked.has(p.floor)" @click="like(p.floor)"><Icon name="heart" :size="14" /><span class="num">{{ p.likes + (liked.has(p.floor) ? 1 : 0) }}</span></button>
                  <button class="mini" @click="replyTo = p"><Icon name="reply" :size="14" />{{ L('回复', '返信') }}</button>
                </div>
                <ul v-if="p.replies.length" class="nested">
                  <li v-for="(r, i) in p.replies" :key="i">
                    <b>{{ users[r.author].name }}</b><span v-if="r.author === thread.author" class="tag">{{ L('楼主', '投稿者') }}</span>
                    <span class="ntext">{{ r.text }}</span>
                    <span class="t-caption">{{ r.ago }}</span>
                  </li>
                </ul>
              </div>
            </li>
          </ol>
        </section>

        <form class="composer" @submit.prevent="send">
          <div v-if="replyTo" class="replying"><span>{{ L('回复', '返信先：') }} #{{ replyTo.floor }} {{ users[replyTo.author].name }}</span><button type="button" class="icon-btn" :aria-label="L('取消回复', '返信をやめる')" @click="replyTo = null"><Icon name="close" :size="14" /></button></div>
          <div class="crow">
            <textarea v-model="draft" class="textarea" rows="2" :disabled="!isAuthed" :placeholder="isAuthed ? L('写下你的回复', '返信を書く') : L('登录后参与讨论', 'ログインして返信')" />
            <div class="cbtns">
              <button type="button" class="icon-btn" :aria-label="L('添加图片（最多 4 张）', '画像を追加（4 枚まで）')" :disabled="!isAuthed"><Icon name="image" /></button>
              <button v-if="isAuthed" class="btn btn-primary" :disabled="!draft.trim()">{{ L('回复', '返信する') }}</button>
              <RouterLink v-else to="/login" class="btn btn-primary">{{ L('登录', 'ログイン') }}</RouterLink>
            </div>
          </div>
        </form>
      </article>

      <aside class="side only-desktop">
        <section v-if="song" class="panel chartcard">
          <h2 class="t-h3">{{ L('这帖讨论的谱面', 'このスレッドの譜面') }}</h2>
          <RouterLink :to="`/songs/${song.id}?d=${thread.song.d}`" class="cc-song">
            <Cover :song="song" size="lg" />
            <span class="grow"><b>{{ songTitle(song) }}</b><Diff :d="thread.song.d" :star="chart.star" :constant="chart.constant" /></span>
          </RouterLink>
          <template v-if="mine">
            <div class="mine">
              <span class="t-caption">{{ L('我的最好成绩', '自己ベスト') }}</span>
              <div class="row"><Crown :v="mine.crown" /><b class="num">{{ fmt(mine.score) }}</b><Rank :v="mine.rank" /></div>
              <div class="judge"><i class="g" :style="{ flex: mine.good }" /><i class="o" :style="{ flex: mine.ok }" /><i class="n" :style="{ flex: mine.ng }" /></div>
              <span class="t-caption num">{{ L('良', '良') }} {{ mine.good }} · {{ L('可', '可') }} {{ mine.ok }} · {{ L('不可', '不可') }} {{ mine.ng }}</span>
            </div>
          </template>
          <RouterLink :to="`/songs/${song.id}?d=${thread.song.d}`" class="btn btn-block">{{ L('查看谱面与数据', '譜面とデータを見る') }}</RouterLink>
        </section>
        <section>
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
  color: var(--ka-ink);
}
.title {
  margin: 12px 0 18px;
  font-size: clamp(1.5rem, 2.6vw, 2.125rem);
  font-weight: 900;
  line-height: 1.3;
  text-wrap: balance;
}
.byline {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--line);
}
.name {
  font-weight: 700;
  margin-right: 6px;
}
.name:hover {
  color: var(--ka-ink);
}
.who {
  display: block;
}
.body {
  padding: 24px 0 8px;
  font-size: var(--fs-16);
  line-height: 1.85;
}
.body > * + * {
  margin-top: 1.1em;
}
.body ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.body li {
  position: relative;
  padding-left: 22px;
}
.body li::before {
  content: '';
  position: absolute;
  left: 2px;
  top: 0.62em;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--don);
  box-shadow: inset 0 0 0 2px var(--bg);
  outline: 1px solid var(--don);
}
.body figure {
  display: flex;
  flex-direction: column;
  gap: 6px;
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
  height: 38px;
  padding: 0 14px;
  border-radius: var(--r-note);
  border: 1px solid var(--line-strong);
  font-size: var(--fs-13);
  font-weight: 500;
  color: var(--ink-2);
}
.act:hover {
  border-color: var(--ink-3);
  color: var(--ink);
}
.act b {
  font-size: var(--fs-16);
}
.act[aria-pressed='true'] {
  background: var(--don-wash);
  border-color: var(--don);
  color: var(--don-ink);
}
.act.quiet {
  border-color: transparent;
  color: var(--ink-3);
}
.replies {
  margin-top: 32px;
}
.replies ol {
  margin-top: 8px;
}
.post {
  display: flex;
  gap: 14px;
  padding: 18px 0;
  border-bottom: 1px solid var(--line);
}
.phead {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.floor {
  margin-left: auto;
  color: var(--ink-3);
  font-size: var(--fs-13);
}
.ptext {
  margin-top: 6px;
  font-size: var(--fs-14);
  line-height: 1.75;
}
.pacts {
  display: flex;
  gap: 4px;
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
  color: var(--ink-3);
}
.mini:hover {
  background: var(--bg-sunk);
  color: var(--ink);
}
.mini[aria-pressed='true'] {
  color: var(--don-ink);
}
.nested {
  margin-top: 10px;
  padding: 4px 14px;
  border-left: 2px solid var(--line-strong);
}
.nested li {
  padding: 7px 0;
  font-size: var(--fs-13);
  line-height: 1.6;
}
.nested b {
  margin-right: 6px;
}
.nested .tag {
  margin-right: 6px;
}
.ntext {
  margin-right: 8px;
  color: var(--ink);
}
.composer {
  position: sticky;
  bottom: 0;
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
  color: var(--ka-ink);
  font-weight: 500;
}
.crow {
  display: flex;
  gap: 10px;
  align-items: flex-end;
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
  line-height: 1.3;
}
.mine {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
}
.mine b {
  flex: 1;
  font-size: var(--fs-28);
  line-height: 1;
}
.ruled {
  border-top: 1px solid var(--line-strong);
}
.linked {
  display: flex !important;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  margin-top: 16px;
}
@media (max-width: 1099px) {
  .cols {
    grid-template-columns: minmax(0, 760px);
  }
  .side {
    display: none !important;
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
    font-size: 15px;
  }
  .actions {
    overflow-x: auto;
  }
  .act.quiet {
    display: none;
  }
  .post {
    gap: 10px;
  }
  .composer {
    bottom: calc(var(--tab-h) + env(safe-area-inset-bottom));
    margin: 20px calc(var(--gutter) * -1) 0;
    padding: 10px var(--gutter);
  }
  .cbtns .icon-btn {
    display: none;
  }
}
</style>
