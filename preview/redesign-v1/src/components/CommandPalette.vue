<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Icon from './Icon.vue'
import Cover from './Cover.vue'
import Diff from './Diff.vue'
import Crown from './Crown.vue'
import Rank from './Rank.vue'
import * as mock from '../mock/data'
import { store, L, songTitle, songSub, subLang, runSync, isReady, resolvedTheme, recentIds, clearRecent, viewport, reducedMotion, ensureSearch } from '../store'
import { searchSongs, parseConfig, findConfig, parseNotes, findNotes, searchThreads, searchActions, searchPages, songOf, defaultDiff, EXAMPLES } from '../search'
import { trapTab, restoreFocus } from '../focusTrap'

// 全局搜索 / 命令面板（P1–P10）。
// 输入框是 combobox，结果是一个 listbox（按组分 group）；当前项用 aria-activedescendant 指示。
const router = useRouter()
const q = ref('')
const idx = ref(0)
const input = ref(null)
const pal = ref(null)
const body = ref(null)
let opener = null
let navigated = false

const scoreOf = (id, d) => {
  try {
    return mock.scoreOf?.(id, d) || null
  } catch {
    return null
  }
}
const sectionOf = (slug) => {
  try {
    return mock.sectionBySlug?.[slug] || null
  } catch {
    return null
  }
}
const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('en-US'))

/* ---------------- 结果 ---------------- */
const term = computed(() => q.value.trim())
const songRes = computed(() => (term.value ? searchSongs(term.value, 8, { locale: store.locale }) : { items: [], total: 0 }))
const cfg = computed(() => (term.value ? parseConfig(term.value) : null))
const notesN = computed(() => (term.value ? parseNotes(term.value) : null))

const groups = computed(() => {
  const out = []
  const t = term.value
  if (!t) {
    const rec = recentIds.value.map((id) => songOf(id)).filter(Boolean)
    if (rec.length) {
      out.push({
        key: 'recent',
        title: L('最近看过', '最近見た楽曲'),
        items: [...rec.map((song) => ({ type: 'song', key: `r${song.id}`, song, d: defaultDiff(song) })), { type: 'clear', key: 'clear', label: L('清除最近看过', '履歴を消去') }],
      })
    }
    const acts = searchActions('', { canSync: canSync.value, ready: isReady.value })
    out.push({ key: 'actions', title: L('操作', '操作'), items: acts.map((a) => ({ type: 'action', key: `a-${a.key}`, action: a })) })
    return out
  }

  // 歌曲
  const sr = songRes.value
  if (sr.items.length) {
    out.push({
      key: 'songs',
      title: L('歌曲', '楽曲'),
      items: [
        ...sr.items.map((x) => ({ type: 'song', key: `s${x.song.id}`, song: x.song, matched: x.matched, d: x.d })),
        // 曲库用同一个 matchSongIds 过滤、shelf=all 不限上架状态，所以 N 等于曲库显示的行数（I8）
        // C8：结果已全部列出时（总数 ≤ 已显示条数）不显示「查看全部」
        ...(sr.total > sr.items.length
          ? [{ type: 'more', key: 'more-songs', icon: 'library', label: L(`在曲库中查看全部 ${sr.total} 首`, `楽曲一覧ですべて表示（${sr.total} 曲）`), to: { path: '/songs', query: { q: t, shelf: 'all' } } }]
          : []),
      ],
    })
  }
  // 按配置查谱
  if (cfg.value?.isConfig) {
    const r = findConfig(cfg.value, 5)
    out.push({
      key: 'cfg',
      title: L('按配置查谱', '配置で検索'),
      parse: cfg.value,
      // 数据模块没有命中：显示「没有找到」，末行把同一查询带到工具页调整条件
      empty: r.items.length ? '' : L('没有找到含这个配置的谱面', 'この配置を含む譜面は見つかりませんでした'),
      items: [
        ...r.items.map((m) => ({ type: 'cfg', key: `c${m.song.id}-${m.chart.d}`, ...m })),
        { type: 'more', key: 'more-cfg', icon: 'layers', label: r.total ? L(`在工具页查看全部 ${r.total} 张`, `ツールですべて表示（${r.total} 譜面）`) : L('在工具页调整条件', 'ツールで条件を変える'), to: { path: '/tools', query: { q: t } } },
      ],
    })
  }
  // 按物量查谱
  if (notesN.value) {
    const r = findNotes(notesN.value, 5)
    if (r.length)
      out.push({
        key: 'notes',
        title: L(`按物量查谱 · ${notesN.value}`, `ノーツ数で検索 · ${notesN.value}`),
        items: [
          ...r.map((m) => ({ type: 'notes', key: `n${m.song.id}-${m.chart.d}`, ...m })),
          { type: 'more', key: 'more-notes', icon: 'music', label: L('在工具页查看', 'ツールで表示'), to: { path: '/tools', query: { notes: String(notesN.value) } } },
        ],
      })
  }
  // 帖子
  const th = searchThreads(t, 4)
  if (th.items.length) {
    out.push({
      key: 'threads',
      title: L('帖子', '投稿'),
      items: [
        ...th.items.map((thread) => ({ type: 'thread', key: `t${thread.id}`, thread })),
        { type: 'more', key: 'more-threads', icon: 'community', label: L(`在社区搜索「${t}」`, `コミュニティで「${t}」を検索`), to: { path: '/community', query: { q: t } } },
      ],
    })
  }
  // 操作
  const top = sr.items[0]
  const acts = searchActions(t, { canSync: canSync.value, ready: isReady.value, song: top?.song, d: top?.d })
  if (acts.length) out.push({ key: 'actions', title: L('操作', '操作'), items: acts.map((a) => ({ type: 'action', key: `a-${a.key}`, action: a })) })
  // 页面
  const pages = searchPages(t)
  if (pages.length) out.push({ key: 'pages', title: L('页面', 'ページ'), items: pages.map((p) => ({ type: 'page', key: `p${p.path}`, page: p })) })
  return out
})
const canSync = computed(() => store.auth === 'ready' || store.auth === 'empty')

// 扁平化 + 稳定 id
const flat = computed(() => {
  const list = []
  for (const g of groups.value) for (const it of g.items) list.push(it)
  return list
})
const indexOf = computed(() => new Map(flat.value.map((it, i) => [it, i])))
const optId = (i) => `pal-opt-${i}`
const activeId = computed(() => (flat.value.length ? optId(idx.value) : undefined))
const resultCount = computed(() => flat.value.filter((x) => x.type !== 'more' && x.type !== 'clear').length)

/* ---------------- 执行 ---------------- */
function withFrom(to) {
  const loc = typeof to === 'string' ? { path: to, query: {} } : { path: to.path, query: { ...(to.query || {}) } }
  loc.query.from = 'search'
  if (term.value && loc.query.q == null) loc.query.q = term.value
  return loc
}
function songTo(song, d, extra = {}) {
  return withFrom({ path: `/songs/${song.id}`, query: { d: String(d), ...extra } })
}
function nav(to) {
  navigated = true
  router.push(to)
  close()
}
function runAction(a) {
  if (a.to) return nav(withFrom(a.to.includes('?') ? { path: a.to.split('?')[0], query: Object.fromEntries(new URLSearchParams(a.to.split('?')[1])) } : a.to))
  if (a.run === 'sync') runSync()
  else if (a.run === 'theme') store.theme = resolvedTheme.value === 'dark' ? 'light' : 'dark'
  else if (a.run === 'lang') store.locale = store.locale === 'zh' ? 'ja' : 'zh'
  close()
}
function run(item) {
  if (!item) return
  switch (item.type) {
    case 'song':
      return nav(songTo(item.song, item.d))
    case 'cfg':
      return nav(songTo(item.song, item.chart.d, { m: String(item.measure) }))
    case 'notes':
      return nav(songTo(item.song, item.chart.d))
    case 'thread':
      return nav(withFrom(`/community/t/${item.thread.id}`))
    case 'more':
      return nav(withFrom(item.to))
    case 'page':
      return nav(withFrom(item.page.path))
    case 'action':
      return runAction(item.action)
    case 'clear':
      clearRecent()
      idx.value = 0
      input.value?.focus()
      return
  }
}
function openDiff(item, d) {
  nav(songTo(item.song, d))
}
function useExample(ex) {
  q.value = ex
  input.value?.focus()
}

/* ---------------- 键盘（P7） ---------------- */
let byKey = false
function move(to) {
  const n = flat.value.length
  if (!n) return
  byKey = true
  idx.value = ((to % n) + n) % n
}
function onKey(e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    if (store.paletteOpen) close()
    else store.paletteOpen = true
    return
  }
  if (e.key === '/' && !store.paletteOpen && !e.defaultPrevented) {
    const el = document.activeElement
    if (/input|textarea|select/i.test(el?.tagName || '') || el?.isContentEditable) return
    e.preventDefault()
    store.paletteOpen = true
    return
  }
  if (!store.paletteOpen) return
  if (e.key === 'Tab') trapTab(e, pal.value)
  else if (e.key === 'Escape') {
    e.preventDefault()
    close()
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    move(idx.value + 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    move(idx.value - 1)
  } else if ((e.key === 'Home' || e.key === 'End') && flat.value.length && document.activeElement === input.value) {
    e.preventDefault()
    move(e.key === 'Home' ? 0 : flat.value.length - 1)
  } else if (e.key === 'Enter' && !e.isComposing && document.activeElement === input.value) {
    e.preventDefault()
    run(flat.value[idx.value])
  }
}
// 鼠标真正移动才改变当前项；列表滚动（指针下的行变了但指针没动）不改变
let lastPt = ''
function onHover(e, i) {
  const pt = `${e.screenX},${e.screenY}`
  if (pt === lastPt) return
  lastPt = pt
  byKey = false
  idx.value = i
}
watch(idx, async () => {
  if (!byKey) return
  byKey = false
  await nextTick()
  document.getElementById(optId(idx.value))?.scrollIntoView({ block: 'nearest' })
})
watch(q, () => {
  idx.value = 0
  if (body.value) body.value.scrollTop = 0
})

/* ---------------- 手机（P9）：visualViewport 让结果区避开软键盘；滚动结果时收起键盘 ---------------- */
const vv = ref({ h: null, top: 0 })
function onVV() {
  const v = window.visualViewport
  if (v) vv.value = { h: v.height, top: v.offsetTop }
}
function listenVV(on) {
  const v = window.visualViewport
  if (!v) return
  if (on) {
    v.addEventListener('resize', onVV)
    v.addEventListener('scroll', onVV)
    onVV()
  } else {
    v.removeEventListener('resize', onVV)
    v.removeEventListener('scroll', onVV)
    vv.value = { h: null, top: 0 }
  }
}
const palStyle = computed(() => (viewport.phone && vv.value.h ? { height: `${vv.value.h}px`, transform: `translateY(${vv.value.top}px)` } : null))
function onBodyTouchMove() {
  if (viewport.phone && document.activeElement === input.value) input.value.blur()
}

/* ---------------- 开关与焦点（P8） ---------------- */
function close() {
  store.paletteOpen = false
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  listenVV(false)
  if (store.paletteOpen) document.documentElement.style.overflow = ''
})
watch(
  () => store.paletteOpen,
  async (v) => {
    document.documentElement.style.overflow = v ? 'hidden' : ''
    if (v) {
      ensureSearch()
      opener = document.activeElement
      navigated = false
      q.value = ''
      idx.value = 0
      listenVV(true)
      await nextTick()
      input.value?.focus()
    } else {
      listenVV(false)
      // 执行了导航：焦点交给新页面的主内容区（router.afterEach 播报页面名）；否则还给触发它的元素
      if (!navigated) restoreFocus(opener)
      opener = null
    }
  },
)

/* ---------------- 行内容 ---------------- */
const DS = [4, 5]
function chartOf(song, d) {
  return song.charts?.find((c) => c.d === d) || null
}
function mineOf(song, d) {
  return isReady.value ? scoreOf(song.id, d) : null
}
function subLine(item) {
  const m = item.matched
  if (m?.kind === 'alias') return { text: L(`别名：${m.text}`, `別名：${m.text}`), lang: null }
  if (m?.kind === 'artist') return { text: item.song.artist || '—', lang: null }
  if (m?.kind === 'id') return { text: `ID ${item.song.id}`, lang: null }
  const sub = songSub(item.song)
  return sub ? { text: sub, lang: subLang.value } : { text: item.song.artist || '—', lang: null }
}
const placeholder = computed(() => L('曲名、别名、帖子，或「16 oxxo 180 鬼10」', '曲名・別名・投稿、または「16 oxxo 180 鬼10」'))
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="store.paletteOpen" class="scrim" :class="{ rm: reducedMotion }" @click.self="close">
        <div ref="pal" class="pal" role="dialog" aria-modal="true" :aria-label="L('搜索', '検索')" :style="palStyle">
          <div class="pal-in">
            <Icon name="search" aria-hidden="true" />
            <input
              ref="input"
              v-model="q"
              class="q"
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls="pal-list"
              aria-autocomplete="list"
              :aria-activedescendant="activeId"
              :aria-label="L('搜索歌曲、帖子、工具', '楽曲・投稿・ツールを検索')"
              :placeholder="placeholder"
              enterkeyhint="search"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
            />
            <button type="button" class="btn btn-ghost btn-sm cancel" @click="close">{{ L('取消', 'キャンセル') }}</button>
          </div>

          <div ref="body" class="pal-body" @touchmove.passive="onBodyTouchMove">
            <div id="pal-list" role="listbox" :aria-label="L('搜索结果', '検索結果')">
              <div v-for="g in groups" :key="g.key" role="group" :aria-labelledby="`pal-g-${g.key}`" class="grp">
                <div :id="`pal-g-${g.key}`" class="g-title">{{ g.title }}</div>

                <!-- P3：配置串的解析结果 -->
                <div v-if="g.parse" class="parse" aria-hidden="true">
                  <span v-if="g.parse.division" class="tok"><small>{{ L('分音', '分音符') }}</small><b class="num">{{ g.parse.division }}</b></span>
                  <span class="tok pat">
                    <small>{{ L('配置', '配置') }}</small>
                    <span class="pat-notes"><i v-for="(ch, i) in g.parse.pattern" :key="i" class="note" :class="{ ka: ch === 'x' }" /></span>
                  </span>
                  <span v-if="g.parse.bpm" class="tok"><small>BPM</small><b class="num">{{ g.parse.bpm }}</b></span>
                  <span v-if="g.parse.d" class="tok"><small>{{ L('难度', '難易度') }}</small><Diff :d="g.parse.d" :star="g.parse.star" short /></span>
                </div>
                <p v-if="g.empty" class="g-empty">{{ g.empty }}</p>

                <div
                  v-for="item in g.items"
                  :id="optId(indexOf.get(item))"
                  :key="item.key"
                  role="option"
                  class="item"
                  :class="[item.type, { on: idx === indexOf.get(item) }]"
                  :aria-selected="idx === indexOf.get(item)"
                  @mousedown.prevent
                  @mousemove="onHover($event, indexOf.get(item))"
                  @click="run(item)"
                >
                  <!-- 歌曲（P2） -->
                  <template v-if="item.type === 'song'">
                    <Cover :song="item.song" />
                    <span class="grow">
                      <span class="t truncate" :title="songTitle(item.song)">{{ songTitle(item.song) }}</span>
                      <span class="s truncate" :lang="subLine(item).lang">{{ subLine(item).text }}</span>
                    </span>
                    <span class="diffs">
                      <span v-for="d in DS" :key="d" class="dcol">
                        <template v-if="chartOf(item.song, d)">
                          <a :href="router.resolve(songTo(item.song, d)).href" class="dchip" tabindex="-1" :aria-label="L(d === 5 ? '打开里谱' : '打开魔王', d === 5 ? '裏譜面を開く' : 'おにを開く')" @click.stop.prevent="openDiff(item, d)">
                            <Diff :d="d" :star="chartOf(item.song, d).star" :constant="chartOf(item.song, d).constant" short />
                            <span v-if="chartOf(item.song, d).constant == null" class="na kna">—</span>
                          </a>
                          <span class="my">
                            <template v-if="mineOf(item.song, d)">
                              <Crown :v="mineOf(item.song, d).crown" size="sm" />
                              <Rank :v="mineOf(item.song, d).rank" />
                              <span class="num sc">{{ fmt(mineOf(item.song, d).score) }}</span>
                            </template>
                            <span v-else class="na">—</span>
                          </span>
                        </template>
                        <span v-else class="na dnone">{{ L(d === 5 ? '无里谱' : '无魔王', d === 5 ? '裏なし' : 'おになし') }}</span>
                      </span>
                    </span>
                  </template>

                  <!-- 配置命中（P3） -->
                  <template v-else-if="item.type === 'cfg'">
                    <Cover :song="item.song" />
                    <span class="grow">
                      <span class="t truncate" :title="songTitle(item.song)">{{ songTitle(item.song) }}</span>
                      <span class="s">BPM {{ item.song.bpm }}</span>
                    </span>
                    <Diff :d="item.chart.d" :star="item.chart.star" short />
                    <span class="meta">{{ L('第 ', '') }}<b class="num">{{ item.measure }}</b>{{ L(' 小节', ' 小節目') }}</span>
                    <span class="meta"><b class="num">{{ item.times }}</b> {{ L('次', '回') }}</span>
                  </template>

                  <!-- 物量命中（P4） -->
                  <template v-else-if="item.type === 'notes'">
                    <Cover :song="item.song" />
                    <span class="grow">
                      <span class="t truncate" :title="songTitle(item.song)">{{ songTitle(item.song) }}</span>
                      <span class="s truncate">{{ item.song.artist || '—' }}</span>
                    </span>
                    <Diff :d="item.chart.d" :star="item.chart.star" short />
                    <span class="meta"><b class="num">{{ fmt(item.chart.notes) }}</b></span>
                    <span v-if="item.delta === 0" class="tag tag-ok">{{ L('一致', '一致') }}</span>
                    <span v-else class="meta num delta">{{ item.delta > 0 ? '+' : '−' }}{{ Math.abs(item.delta) }}</span>
                  </template>

                  <!-- 帖子（P5） -->
                  <template v-else-if="item.type === 'thread'">
                    <span class="ic" :style="sectionOf(item.thread.section)?.color ? { color: sectionOf(item.thread.section).color } : null"><Icon name="community" /></span>
                    <span class="grow">
                      <span class="t truncate" :title="item.thread.title">{{ item.thread.title }}</span>
                      <span class="s truncate">{{ sectionOf(item.thread.section) ? L(sectionOf(item.thread.section).zh, sectionOf(item.thread.section).ja) : '' }} · {{ item.thread.replies }} {{ L('回复', '返信') }}</span>
                    </span>
                  </template>

                  <!-- 操作 -->
                  <template v-else-if="item.type === 'action'">
                    <span class="ic"><Icon :name="item.action.key === 'theme' ? (resolvedTheme === 'dark' ? 'sun' : 'moon') : item.action.icon" /></span>
                    <span class="grow">
                      <span class="t truncate">{{ L(item.action.zh, item.action.ja) }}</span>
                    </span>
                  </template>

                  <!-- 页面 -->
                  <template v-else-if="item.type === 'page'">
                    <span class="ic"><Icon name="arrowUR" /></span>
                    <span class="grow">
                      <span class="t truncate">{{ L(item.page.zh, item.page.ja) }}</span>
                    </span>
                  </template>

                  <!-- 末行：查看全部 / 清除 -->
                  <template v-else>
                    <span class="ic sm"><Icon :name="item.type === 'clear' ? 'trash' : item.icon" :size="18" /></span>
                    <span class="grow"><span class="t">{{ item.label }}</span></span>
                  </template>

                  <Icon v-if="item.type !== 'clear'" name="chevR" :size="16" class="go" />
                </div>
              </div>
            </div>

            <!-- 无结果 -->
            <div v-if="term && !resultCount" class="none">
              <b>{{ L(`没有找到「${term}」`, `「${term}」は見つかりませんでした`) }}</b>
              <span class="t-small">{{ L('试试日文原名、中文译名、别名或艺术家。', '日本語の原題・中国語名・別名・アーティストでも検索できます。') }}</span>
            </div>

            <!-- 示例查询（P9）：点了就填入并出结果 -->
            <div v-if="!term || !resultCount" class="examples">
              <span class="t-caption">{{ L('试试', '例') }}</span>
              <button v-for="ex in EXAMPLES" :key="ex" type="button" class="chip ex" @mousedown.prevent @click="useExample(ex)">{{ ex }}</button>
            </div>

            <p class="sr-only" role="status" aria-live="polite">{{ term ? L(`${resultCount} 个结果`, `${resultCount} 件`) : '' }}</p>
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
  width: min(720px, 100%);
  max-height: 76dvh;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-radius: var(--overlay-radius);
  box-shadow: var(--overlay-shadow);
  overflow: hidden;
  animation: drop var(--dur-2) var(--ease-out);
}
.rm .pal {
  animation: none;
}
@keyframes drop {
  from {
    transform: translateY(-8px);
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
  flex: none;
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
.q:focus,
.q:focus-visible {
  outline: none;
  box-shadow: none;
}
.q::placeholder {
  color: var(--ink-3);
  font-size: var(--fs-16);
}
.pal-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 6px 8px 10px;
}
.g-empty {
  padding: 4px 10px 8px;
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.g-title {
  padding: 12px 10px 6px;
  font-size: var(--fs-12);
  font-weight: 500;
  color: var(--ink-3);
}
.parse {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 2px 10px 8px;
}
.tok {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 3px 10px;
  border-radius: var(--r-ctl);
  background: var(--bg-sunk);
}
.tok small {
  font-size: var(--fs-11);
  color: var(--ink-2);
}
.pat-notes {
  display: flex;
  gap: 3px;
}
.pat-notes .note {
  --n: 14px;
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
  cursor: pointer;
}
.item.more,
.item.clear,
.item.action,
.item.page {
  min-height: 48px;
}
.item.on {
  background: var(--bg-sunk);
}
.item .grow {
  min-width: 0;
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
  color: var(--ink-2);
}
.item.more .t,
.item.clear .t {
  font-weight: 500;
  color: var(--ink-2);
}
.ic {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: var(--r-ctl);
  background: var(--bg-sunk);
  color: var(--ink-2);
  flex: none;
}
.ic.sm {
  height: 36px;
  background: none;
}
.item.on .ic {
  background: var(--surface);
}
.item.on .ic.sm {
  background: none;
}
.diffs {
  display: flex;
  gap: 12px;
  flex: none;
}
.dcol {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
  min-width: 96px;
}
.dchip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-radius: var(--r-xs);
}
.dchip:hover {
  box-shadow: 0 0 0 2px var(--line-strong);
}
.my {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--fs-12);
  color: var(--ink-2);
}
.na {
  color: var(--ink-3);
  font-size: var(--fs-12);
}
.dnone {
  padding-top: 2px;
}
.meta {
  flex: none;
  font-size: var(--fs-13);
  color: var(--ink-2);
  white-space: nowrap;
}
.meta b {
  font-size: var(--fs-16);
  color: var(--ink);
}
.delta {
  min-width: 36px;
  text-align: right;
}
.go {
  color: var(--ink-3);
  opacity: 0;
  flex: none;
}
.item.on .go {
  opacity: 1;
}
.none {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px 20px 12px;
  text-align: center;
}
.examples {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 14px 10px 6px;
}
.ex {
  font-family: inherit;
}
.pal-foot {
  display: flex;
  gap: 16px;
  padding: 10px 16px;
  border-top: 1px solid var(--line);
  font-size: var(--fs-12);
  color: var(--ink-2);
  flex: none;
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
    align-items: stretch;
  }
  .pal {
    width: 100%;
    height: 100dvh;
    max-height: none;
    border-radius: 0;
    animation: none;
  }
  .pal-in {
    position: sticky;
    top: 0;
    padding: 6px 4px 6px 14px;
  }
  .cancel {
    min-height: 44px;
  }
  .q {
    font-size: 16px;
  }
  .q::placeholder {
    font-size: 15px;
  }
  .item {
    gap: 10px;
    padding: 6px 8px;
  }
  .diffs {
    gap: 6px;
  }
  .dcol {
    min-width: 0;
  }
  .diffs :deep(.diff .k),
  /* 手机：每个难度只显示「难度短名 + 星级」与「王冠 + 评价」，数字成绩与定数在 ≥ 768px 才显示 */
  .my .sc,
  .kna {
    display: none;
  }
  .go {
    display: none;
  }
  .ex {
    min-height: 44px;
  }
}
</style>
