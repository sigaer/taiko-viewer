<script setup>
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import Icon from '../components/Icon.vue'
import EmptyLane from '../components/EmptyLane.vue'
import { notifications, users } from '../mock/data'
import { store, L, toast } from '../store'

// 本地副本：已读状态只在这一页内变化。
const items = ref(notifications.map((n) => ({ ...n })))
const FILTERS = [
  { key: 'all', zh: '全部', ja: 'すべて' },
  { key: 'reply', zh: '回复', ja: '返信', emptyZh: '有人回复你的帖子或楼层时，会出现在这里。', emptyJa: '投稿やコメントに返信があると、ここに表示されます。' },
  { key: 'mention', zh: '提到我', ja: 'メンション', emptyZh: '有人在帖子里 @ 你时，会出现在这里。', emptyJa: '投稿で @ されると、ここに表示されます。' },
  { key: 'like', zh: '赞', ja: 'いいね', emptyZh: '帖子或回复收到赞时，会出现在这里。', emptyJa: '投稿や返信にいいねが付くと、ここに表示されます。' },
  { key: 'system', zh: '系统', ja: 'システム', emptyZh: '同步结果、站务处理和活动提醒会出现在这里。', emptyJa: '同期結果・運営からの連絡・イベントのお知らせがここに表示されます。' },
]
const TYPE = {
  reply: { zh: '回复', ja: '返信', icon: 'reply' },
  mention: { zh: '提到我', ja: 'メンション', icon: 'community' },
  like: { zh: '赞', ja: 'いいね', icon: 'heart' },
  system: { zh: '系统', ja: 'システム', icon: 'bell' },
}
const filter = ref('all')
const current = computed(() => FILTERS.find((f) => f.key === filter.value))
const list = computed(() => (filter.value === 'all' ? items.value : items.value.filter((n) => n.type === filter.value)))
const unread = computed(() => items.value.filter((n) => n.unread).length)
const unreadOf = (key) => items.value.filter((n) => n.unread && (key === 'all' || n.type === key)).length

function read(n) {
  n.unread = false
}
function readAll() {
  const n = unread.value
  items.value.forEach((x) => (x.unread = false))
  toast(L(`${n} 条通知已标为已读`, `${n} 件を既読にしました`))
}
const actor = (n) => (n.type === 'system' ? L('系统通知', 'システム通知') : users[n.who].name)
</script>

<template>
  <div class="page notif">
    <EmptyLane v-if="store.auth === 'guest'" :title="L('登录后查看通知', 'ログインして通知を見る')" :text="L('回复、提到你的帖子和同步结果都会出现在这里。', '返信・メンション・同期結果がここに表示されます。')">
      <RouterLink to="/login" class="btn btn-primary">{{ L('登录', 'ログイン') }}</RouterLink>
      <RouterLink to="/login?mode=register" class="btn">{{ L('注册', '新規登録') }}</RouterLink>
    </EmptyLane>

    <template v-else>
      <header class="page-head">
        <div>
          <h1 class="t-h1">{{ L('通知', '通知') }}</h1>
          <p class="t-small" aria-live="polite">
            <template v-if="unread"><span class="num">{{ unread }}</span> {{ L('条未读', '件の未読') }}</template>
            <template v-else>{{ L('全部已读', 'すべて既読') }}</template>
          </p>
        </div>
        <button type="button" class="btn" :disabled="!unread" @click="readAll"><Icon name="check" :size="16" />{{ L('全部标为已读', 'すべて既読にする') }}</button>
      </header>

      <div class="scroll-x filters">
        <div class="seg" role="group" :aria-label="L('按类型筛选', '種類で絞り込み')">
          <button v-for="f in FILTERS" :key="f.key" type="button" :aria-pressed="filter === f.key" @click="filter = f.key">
            {{ L(f.zh, f.ja) }}<span v-if="unreadOf(f.key)" class="num cnt">{{ unreadOf(f.key) }}</span>
          </button>
        </div>
      </div>

      <div class="panel list-panel">
        <ul v-if="list.length">
          <li v-for="n in list" :key="n.id" class="item" :class="{ unread: n.unread }">
            <span class="gut"><i v-if="n.unread" class="note" /><span v-if="n.unread" class="sr-only">{{ L('未读', '未読') }}</span></span>
            <component :is="n.thread ? RouterLink : 'div'" :to="n.thread ? `/community/t/${n.thread}` : undefined" class="main" @click="n.thread && read(n)">
              <span class="avatar" :style="{ background: `hsl(${users[n.who].hue} 45% 42%)` }">{{ users[n.who].name[0] }}</span>
              <span class="grow">
                <span class="text"><b>{{ actor(n) }}</b> {{ n.text }}</span>
                <span class="meta">
                  <span class="type"><Icon :name="TYPE[n.type].icon" :size="13" />{{ L(TYPE[n.type].zh, TYPE[n.type].ja) }}</span>
                  <span>{{ n.ago }}</span>
                  <span v-if="n.thread" class="open">{{ L('查看帖子', '投稿を見る') }}<Icon name="chevR" :size="12" /></span>
                </span>
              </span>
            </component>
            <button v-if="n.unread" type="button" class="icon-btn mark" :aria-label="L('标为已读', '既読にする')" :title="L('标为已读', '既読にする')" @click="read(n)"><Icon name="check" :size="18" /></button>
          </li>
        </ul>
        <EmptyLane v-else compact :title="L(`没有「${current.zh}」类通知`, `「${current.ja}」の通知はありません`)" :text="L(current.emptyZh, current.emptyJa)">
          <button type="button" class="btn" @click="filter = 'all'">{{ L('查看全部通知', 'すべての通知を見る') }}</button>
        </EmptyLane>
      </div>
    </template>
  </div>
</template>

<style scoped>
.notif {
  max-width: calc(760px + var(--gutter) * 2);
}
.page-head {
  align-items: center;
}
.filters {
  margin-bottom: var(--sp-4);
  scrollbar-width: none;
}
.cnt {
  margin-left: 5px;
  color: var(--don-ink);
}
.list-panel {
  overflow: hidden;
}
.item {
  display: flex;
  align-items: stretch;
  border-bottom: 1px solid var(--line);
}
.item:last-child {
  border-bottom: 0;
}
/* 未读：只在左缘留一条淡朱色带，音符落在带上 */
.gut {
  flex: none;
  display: grid;
  place-items: center;
  width: 30px;
}
.gut .note {
  --n: 10px;
}
.unread .gut {
  background: var(--don-wash);
}
.main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 8px 14px 12px;
}
a.main:hover .text {
  color: var(--ka-ink);
}
a.main:focus-visible {
  box-shadow: inset var(--focus);
}
.text {
  display: block;
  color: var(--ink-2);
  line-height: 1.5;
}
.text b {
  color: var(--ink);
  font-weight: 700;
}
.unread .text {
  color: var(--ink);
}
.meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
  margin-top: 4px;
  font-size: var(--fs-12);
  color: var(--ink-3);
}
.type,
.open {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.open {
  gap: 1px;
  color: var(--ka-ink);
  font-weight: 500;
}
.mark {
  flex: none;
  align-self: center;
  margin-right: 8px;
}

@media (max-width: 767px) {
  .page-head .btn {
    width: 100%;
  }
  .gut {
    width: 22px;
  }
  .main {
    padding-left: 10px;
  }
  .mark {
    margin-right: 2px;
  }
}
</style>
