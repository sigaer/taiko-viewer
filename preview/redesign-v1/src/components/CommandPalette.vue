<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Icon from './Icon.vue'
import Cover from './Cover.vue'
import Diff from './Diff.vue'
import Crown from './Crown.vue'
import { songs, threads, scoreOf, sectionBySlug } from '../mock/data'
import { store, L, songTitle, songSub, subLang, runSync, isReady, resolvedTheme } from '../store'
import { trapTab, restoreFocus } from '../focusTrap'

// 全局搜索 / 命令面板。高频查询的唯一入口：
// 曲名（中/日/别名）→ 直接进到某个难度；「16 oxxo 180 鬼10」这类配置串 → 查配置；也能搜帖子和执行动作。
const router = useRouter()
const q = ref('')
const idx = ref(0)
const input = ref(null)
const pal = ref(null)
let opener = null

const PATTERN = /^\s*(\d{1,2})\s+[oxOX]{2,}/
const RECENT = [615, 233, 100140, 512]

const actions = computed(() => [
  { key: 'sync', icon: 'sync', label: L('同步成绩', '成績を同期'), hint: L('从鼓众广场拉取最新成绩', '最新の成績を取得'), run: () => runSync(), show: isReady.value },
  { key: 'rt', icon: 'target', label: L('单曲 RT 计算器', '単曲 RT 計算'), to: '/tools/rt', show: true },
  { key: 'post', icon: 'edit', label: L('发布新帖', '新規投稿'), to: '/community/new', show: true },
  { key: 'goal', icon: 'flag', label: L('选一个想练的目标', '練習目標を決める'), to: '/growth/goals', show: isReady.value },
  { key: 'b30', icon: 'play', label: L('查看 Rating 构成', 'Rating の内訳'), to: '/play', show: isReady.value },
  { key: 'theme', icon: resolvedTheme.value === 'dark' ? 'sun' : 'moon', label: L('切换深浅色', 'テーマ切替'), run: () => (store.theme = resolvedTheme.value === 'dark' ? 'light' : 'dark'), show: true },
  { key: 'lang', icon: 'globe', label: store.locale === 'zh' ? '日本語に切り替え' : '切换到简体中文', run: () => (store.locale = store.locale === 'zh' ? 'ja' : 'zh'), show: true },
])

const groups = computed(() => {
  const term = q.value.trim().toLowerCase()
  const out = []
  if (!term) {
    out.push({ title: L('最近看过', '最近見た楽曲'), items: RECENT.map((id) => ({ type: 'song', song: songs.find((s) => s.id === id) })) })
    out.push({ title: L('快捷操作', 'クイック操作'), items: actions.value.filter((a) => a.show).map((a) => ({ type: 'action', ...a })) })
    return out
  }
  if (PATTERN.test(q.value)) {
    out.push({ title: L('按配置查谱', '配置で検索'), items: [{ type: 'action', key: 'cfg', icon: 'layers', label: L(`查找含「${q.value.trim()}」配置的谱面`, `「${q.value.trim()}」を含む譜面を探す`), hint: L('分音 · 配置 · BPM · 难度', '分音 · 配置 · BPM · 難易度'), to: '/tools' }] })
  }
  const hit = songs.filter((s) => `${s.ja} ${s.zh} ${s.artist}`.toLowerCase().includes(term)).slice(0, 6)
  if (hit.length) out.push({ title: L('歌曲', '楽曲'), items: hit.map((song) => ({ type: 'song', song })) })
  const th = threads.filter((t) => `${t.title} ${t.tags.join(' ')}`.toLowerCase().includes(term)).slice(0, 4)
  if (th.length) out.push({ title: L('帖子', '投稿'), items: th.map((thread) => ({ type: 'thread', thread })) })
  const ac = actions.value.filter((a) => a.show && a.label.toLowerCase().includes(term))
  if (ac.length) out.push({ title: L('操作', '操作'), items: ac.map((a) => ({ type: 'action', ...a })) })
  return out
})
const flat = computed(() => groups.value.flatMap((g) => g.items))

function close() {
  store.paletteOpen = false
}
function run(item) {
  if (!item) return
  if (item.type === 'song') router.push(`/songs/${item.song.id}`)
  else if (item.type === 'thread') router.push(`/community/t/${item.thread.id}`)
  else if (item.to) router.push(item.to)
  else item.run?.()
  close()
}
function onKey(e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    store.paletteOpen = !store.paletteOpen
    return
  }
  if (e.key === '/' && !store.paletteOpen && !/input|textarea|select/i.test(document.activeElement?.tagName || '')) {
    e.preventDefault()
    store.paletteOpen = true
    return
  }
  if (!store.paletteOpen) return
  if (e.key === 'Tab') trapTab(e, pal.value)
  else if (e.key === 'Escape') close()
  else if (e.key === 'ArrowDown') {
    e.preventDefault()
    idx.value = (idx.value + 1) % Math.max(1, flat.value.length)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    idx.value = (idx.value - 1 + flat.value.length) % Math.max(1, flat.value.length)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    run(flat.value[idx.value])
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
watch(q, () => (idx.value = 0))
watch(
  () => store.paletteOpen,
  async (v) => {
    document.documentElement.style.overflow = v ? 'hidden' : ''
    if (v) {
      opener = document.activeElement
      q.value = ''
      idx.value = 0
      await nextTick()
      input.value?.focus()
    } else {
      restoreFocus(opener)
      opener = null
    }
  },
)
const oni = (song) => song.charts.filter((c) => c.d >= 4)
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="store.paletteOpen" class="scrim" @click.self="close">
        <div ref="pal" class="pal" role="dialog" aria-modal="true" :aria-label="L('搜索', '検索')">
          <div class="pal-in">
            <Icon name="search" />
            <input ref="input" v-model="q" class="q" :placeholder="L('曲名、别名、帖子，或「16 oxxo 180 鬼10」', '曲名・別名・投稿、または「16 oxxo 180 鬼10」')" autocomplete="off" spellcheck="false" />
            <button class="btn btn-ghost btn-sm" @click="close">{{ L('取消', 'キャンセル') }}</button>
          </div>
          <div class="pal-body">
            <template v-for="g in groups" :key="g.title">
              <div class="g-title">{{ g.title }}</div>
              <button v-for="item in g.items" :key="item.key || item.song?.id || item.thread?.id" class="item" :class="{ on: flat[idx] === item }" @mousemove="idx = flat.indexOf(item)" @click="run(item)">
                <template v-if="item.type === 'song'">
                  <Cover :song="item.song" />
                  <span class="grow">
                    <span class="t truncate">{{ songTitle(item.song) }}</span>
                    <span class="s truncate" :lang="songSub(item.song) ? subLang : null">{{ songSub(item.song) || item.song.artist }}</span>
                  </span>
                  <span class="chips">
                    <template v-for="c in oni(item.song)" :key="c.d">
                      <Crown v-if="scoreOf(item.song.id, c.d) && isReady" :v="scoreOf(item.song.id, c.d).crown" size="sm" />
                      <Diff :d="c.d" :star="c.star" :constant="c.constant" short />
                    </template>
                  </span>
                </template>
                <template v-else-if="item.type === 'thread'">
                  <span class="ic" :style="{ color: sectionBySlug[item.thread.section].color }"><Icon name="community" /></span>
                  <span class="grow">
                    <span class="t truncate">{{ item.thread.title }}</span>
                    <span class="s truncate">{{ L(sectionBySlug[item.thread.section].zh, sectionBySlug[item.thread.section].ja) }} · {{ item.thread.replies }} {{ L('回复', '返信') }}</span>
                  </span>
                </template>
                <template v-else>
                  <span class="ic"><Icon :name="item.icon" /></span>
                  <span class="grow">
                    <span class="t truncate">{{ item.label }}</span>
                    <span v-if="item.hint" class="s truncate">{{ item.hint }}</span>
                  </span>
                </template>
                <Icon name="chevR" :size="16" class="go" />
              </button>
            </template>
            <div v-if="!flat.length" class="none">
              <b>{{ L('没有找到「', '「') }}{{ q }}{{ L('」', '」は見つかりませんでした') }}</b>
              <span class="t-small">{{ L('试试日文原名、中文译名或别名。也可以去曲库用筛选条件找。', '日本語の原題・中国語名・別名でも検索できます。') }}</span>
              <RouterLink to="/songs" class="btn btn-sm" @click="close">{{ L('打开曲库', '楽曲一覧を開く') }}</RouterLink>
            </div>
          </div>
          <footer class="pal-foot only-desktop">
            <span><kbd>↑</kbd><kbd>↓</kbd>{{ L('选择', '選択') }}</span>
            <span><kbd>Enter</kbd>{{ L('打开', '開く') }}</span>
            <span><kbd>Esc</kbd>{{ L('关闭', '閉じる') }}</span>
            <span class="grow" />
            <span><kbd>/</kbd>{{ L('随时唤起', 'いつでも呼び出し') }}</span>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.scrim {
  position: fixed;
  inset: 0;
  z-index: var(--z-palette);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 11vh 20px 20px;
  background: var(--scrim);
}
.pal {
  width: min(680px, 100%);
  max-height: 72dvh;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-pop);
  overflow: hidden;
  animation: drop var(--dur-2) var(--ease-out);
}
@keyframes drop {
  from {
    transform: translateY(-10px) scale(0.985);
    opacity: 0;
  }
}
.pal-in {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px 8px 18px;
  border-bottom: 1px solid var(--line);
  color: var(--ink-3);
}
.q {
  flex: 1;
  min-width: 0;
  height: 44px;
  border: 0;
  background: none;
  font-size: var(--fs-18);
  color: var(--ink);
}
.q::placeholder {
  color: var(--ink-3);
  font-size: var(--fs-16);
}
.pal-body {
  overflow-y: auto;
  padding: 6px 8px 10px;
}
.g-title {
  padding: 12px 10px 6px;
  font-size: var(--fs-12);
  font-weight: 500;
  color: var(--ink-3);
}
.item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 56px;
  padding: 6px 10px;
  border-radius: var(--r-ctl);
  text-align: left;
}
.item.on {
  background: var(--bg-sunk);
}
.item .t,
.item .s {
  display: block;
}
.item .t {
  font-weight: 700;
}
.item .s {
  font-size: var(--fs-12);
  color: var(--ink-3);
}
.ic {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 8px;
  background: var(--bg-sunk);
  color: var(--ink-2);
  flex: none;
}
.item.on .ic {
  background: var(--surface);
}
.chips {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: none;
}
.go {
  color: var(--ink-3);
  opacity: 0;
}
.item.on .go {
  opacity: 1;
}
.none {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 36px 20px;
  text-align: center;
}
.pal-foot {
  display: flex;
  gap: 16px;
  padding: 10px 16px;
  border-top: 1px solid var(--line);
  font-size: var(--fs-12);
  color: var(--ink-3);
}
.pal-foot span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
kbd {
  padding: 1px 6px;
  border-radius: var(--r-xs);
  background: var(--bg-sunk);
  font-family: var(--font-num);
  font-size: var(--fs-12);
  font-weight: 600;
  color: var(--ink-2);
}
@media (max-width: 767px) {
  .scrim {
    padding: 0;
  }
  .pal {
    width: 100%;
    height: 100dvh;
    max-height: none;
    border-radius: 0;
    animation: none;
  }
  .q {
    font-size: 16px;
  }
  .q::placeholder {
    font-size: 15px;
  }
  .chips :deep(.diff .k) {
    display: none;
  }
  .go {
    display: none;
  }
}
</style>
