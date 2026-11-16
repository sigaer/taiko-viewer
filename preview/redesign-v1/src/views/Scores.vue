<script setup>
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import Icon from '../components/Icon.vue'
import SongCell from '../components/SongCell.vue'
import Cover from '../components/Cover.vue'
import Diff from '../components/Diff.vue'
import Crown from '../components/Crown.vue'
import Rank from '../components/Rank.vue'
import Sheet from '../components/Sheet.vue'
import Gate from '../components/Gate.vue'
import EmptyLane from '../components/EmptyLane.vue'
import VirtualList from '../components/VirtualList.vue'
import { scores as allScores, songById, player, CROWNS, RANKS, normalize, fmt } from '../mock/data'
import { L, isReady, songTitle, toast, store } from '../store'
import { useQueryState } from '../routeState'
import { useHScroll } from '../hscroll'
import { isMobile } from '../breakpoints'

// 全部成绩：表格只负责读；锁定 / 修改 / 删除在行内操作与抽屉里。
const scores = reactive(allScores.map((s) => ({ ...s, key: `${s.songId}-${s.d}` })))
// 每条成绩的检索文本只算一次（曲名两种语言 + 别名）
const hay = new Map(
  allScores.map((s) => {
    const song = songById[s.songId]
    return [`${s.songId}-${s.d}`, normalize(`${song.ja} ${song.zh} ${(song.aliases || []).join(' ')}`)]
  }),
)

// 表格：行状态挂在 <tr> 上（VirtualList rowClass，I5）；行高跟随列表密度（I10）；横滑提示（I13）
const rowClass = (s) => ({ 'is-locked': s.locked })
const rowH = computed(() => (store.density === 'compact' ? 40 : 48))
const tableWrap = ref(null)
const { overflow, moreRight } = useHScroll(tableWrap)

const SORTS = ['date', 'const', 'score', 'good', 'ok', 'ng', 'combo', 'crown', 'rank', 'plays']
const RANK_OPTS = ['8', '7', '6', '5', '4', '3', '2']
const f = useQueryState({
  q: { type: 'string', default: '', debounce: 250 },
  d: { type: 'string', default: 'all', values: ['all', '4', '5'] },
  crown: { type: 'string', default: 'all', values: ['all', '2', '1', '0', '-1'] },
  rank: { type: 'string', default: 'all', values: ['all', ...RANK_OPTS, 'none'] },
  flag: { type: 'string', default: 'all', values: ['all', 'manual', 'locked'] },
  sort: { type: 'string', default: 'date', values: SORTS },
  dir: { type: 'string', default: 'desc', values: ['asc', 'desc'] },
})

// 数值越大越「靠前」（desc）；更新时间按天数取反，desc = 最近的在前
const VAL = {
  date: (s) => -s.daysAgo,
  const: (s) => s.constant ?? -1,
  score: (s) => s.score,
  good: (s) => s.good,
  ok: (s) => s.ok,
  ng: (s) => s.ng,
  combo: (s) => s.combo,
  crown: (s) => s.crown,
  rank: (s) => s.rank,
  plays: (s) => s.plays,
}
const rows = computed(() => {
  const term = normalize(f.q)
  const crown = f.crown === 'all' ? null : Number(f.crown)
  const d = f.d === 'all' ? null : Number(f.d)
  const rank = f.rank === 'all' ? null : f.rank === 'none' ? 'none' : Number(f.rank)
  const out = []
  for (const s of scores) {
    if (d != null && s.d !== d) continue
    if (crown != null && s.crown !== crown) continue
    if (rank === 'none' ? s.rank >= 2 : rank != null && s.rank !== rank) continue
    if (f.flag === 'manual' && !s.manual) continue
    if (f.flag === 'locked' && !s.locked) continue
    if (term && !hay.get(s.key)?.includes(term)) continue
    out.push(s)
  }
  const val = VAL[f.sort] || VAL.date
  const sign = f.dir === 'asc' ? 1 : -1
  return out.sort((a, b) => (val(a) - val(b)) * sign || a.songId - b.songId || a.d - b.d)
})
const filtered = computed(() => f.q !== '' || f.d !== 'all' || f.crown !== 'all' || f.rank !== 'all' || f.flag !== 'all')
function clearFilters() {
  Object.assign(f, { q: '', d: 'all', crown: 'all', rank: 'all', flag: 'all' })
}
function sortBy(k) {
  if (f.sort === k) f.dir = f.dir === 'asc' ? 'desc' : 'asc'
  else Object.assign(f, { sort: k, dir: k === 'ng' ? 'asc' : 'desc' })
}
const ariaSort = (k) => (f.sort === k ? (f.dir === 'asc' ? 'ascending' : 'descending') : undefined)

const COLS = [
  { key: 'const', zh: '难度 · 定数', ja: '難易度 · 定数', cls: 'c-diff' },
  { key: 'score', zh: '最好成绩', ja: '自己ベスト', cls: 'r' },
  { key: 'good', zh: '良', ja: '良', cls: 'r c-good' },
  { key: 'ok', zh: '可', ja: '可', cls: 'r c-ok' },
  { key: 'ng', zh: '不可', ja: '不可', cls: 'r' },
  { key: 'combo', zh: '连击', ja: 'コンボ', cls: 'r c-combo' },
  { key: 'crown', zh: '王冠', ja: '王冠', cls: 'c' },
  { key: 'rank', zh: '评价', ja: '評価', cls: 'c' },
  { key: 'plays', zh: '次数', ja: '回数', cls: 'r c-plays' },
  { key: 'date', zh: '更新', ja: '更新', cls: 'r' },
]

// 合计全部由成绩算出（M3）；删除后跟着变
const totals = computed(() => {
  let clear = 0
  let fc = 0
  let dfc = 0
  for (const s of scores) {
    if (s.crown >= 0) clear++
    if (s.crown >= 1) fc++
    if (s.crown === 2) dfc++
  }
  return { n: scores.length, clear, fc, dfc }
})

const binding = ref(player.bindings.find((b) => b.current)?.id ?? player.bindings[0]?.id)
const when = (n) => (n === 0 ? L('今天', '今日') : n === 1 ? L('昨天', '昨日') : L(`${n} 天前`, `${n} 日前`))
const songLink = (s) => `/songs/${s.songId}?d=${s.d}&from=scores`

// 触屏平板：行内只放一个「更多」按钮（悬停不可用）
const coarseMq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(hover: none) and (pointer: coarse)') : null
const coarse = ref(!!coarseMq?.matches)
const onCoarse = (e) => (coarse.value = e.matches)
coarseMq?.addEventListener?.('change', onCoarse)
onBeforeUnmount(() => coarseMq?.removeEventListener?.('change', onCoarse))

/* ---------- 修改 / 补录 / 删除 ---------- */
const editing = ref(null)
const importOpen = ref(false)
const confirmDel = ref(null)
const byKey = (key) => scores.find((s) => s.key === key)
function openEdit(s) {
  editing.value = { ...s }
}
function toggleLock(s) {
  s.locked = !s.locked
}
function save() {
  const e = editing.value
  if (!e) return
  if (!e.new) {
    const row = byKey(e.key)
    if (row) {
      const num = (v, old) => (v === '' || v == null || !Number.isFinite(Number(v)) ? old : Math.max(0, Math.floor(Number(v))))
      const next = { score: num(e.score, row.score), good: num(e.good, row.good), ok: num(e.ok, row.ok), ng: num(e.ng, row.ng) }
      const changed = next.score !== row.score || next.good !== row.good || next.ok !== row.ok || next.ng !== row.ng
      Object.assign(row, next, { locked: !!e.locked, manual: row.manual || changed })
    }
  }
  editing.value = null
  toast(L('成绩已保存', '記録を保存しました'))
}
function askDelete() {
  const row = editing.value && byKey(editing.value.key)
  editing.value = null
  if (row) confirmDel.value = row
}
function remove() {
  const i = scores.indexOf(confirmDel.value)
  if (i >= 0) scores.splice(i, 1)
  confirmDel.value = null
  toast(L('已删除这条成绩', '記録を削除しました'), 'info')
}
</script>

<template>
  <div class="page">
    <Gate v-if="!isReady" :what="L('全部成绩', '全成績')" />
    <template v-else>
      <div class="summary">
        <label class="bind">
          <span class="t-caption">{{ L('当前账号', '現在のアカウント') }}</span>
          <select v-model="binding" class="select">
            <option v-for="b in player.bindings" :key="b.id" :value="b.id">{{ b.region }} · {{ b.name }} · {{ b.taikoId }}</option>
          </select>
        </label>
        <div class="stat"><div class="v">{{ fmt(totals.n) }}</div><div class="k">{{ L('有成绩的谱面', '記録のある譜面') }}</div></div>
        <div class="stat"><div class="v">{{ fmt(totals.clear) }}</div><div class="k">{{ L('通关', 'クリア') }}</div></div>
        <div class="stat"><div class="v">{{ fmt(totals.fc) }}</div><div class="k">{{ L('全连', 'フルコンボ') }}</div></div>
        <div class="stat"><div class="v">{{ fmt(totals.dfc) }}</div><div class="k">{{ L('全良', '全良') }}</div></div>
        <div class="acts">
          <button class="btn" @click="importOpen = true"><Icon name="upload" :size="16" />{{ L('导入成绩', 'インポート') }}</button>
          <button class="btn btn-ink" @click="editing = { new: true, songId: 615, d: 4, score: '', good: '', ok: '', ng: '', locked: false }"><Icon name="plus" :size="16" />{{ L('补录一条', '手動で追加') }}</button>
        </div>
      </div>

      <div class="toolbar">
        <label class="search">
          <Icon name="search" :size="18" />
          <input v-model="f.q" class="sinput" type="search" :aria-label="L('按曲名筛选', '曲名で絞り込み')" :placeholder="L('按曲名筛选', '曲名で絞り込み')" />
        </label>
        <div class="chips">
          <div class="cgroup" role="group" :aria-label="L('难度', '難易度')">
            <button class="chip" :aria-pressed="f.d === 'all'" @click="f.d = 'all'">{{ L('全部难度', '全難易度') }}</button>
            <button class="chip" :aria-pressed="f.d === '4'" @click="f.d = '4'">{{ L('魔王', 'おに') }}</button>
            <button class="chip" :aria-pressed="f.d === '5'" @click="f.d = '5'">{{ L('里', '裏') }}</button>
          </div>
          <span class="sep" aria-hidden="true" />
          <div class="cgroup" role="group" :aria-label="L('王冠', '王冠')">
            <button class="chip" :aria-pressed="f.crown === 'all'" @click="f.crown = 'all'">{{ L('全部王冠', '全王冠') }}</button>
            <button v-for="c in ['2', '1', '0', '-1']" :key="c" class="chip" :aria-pressed="f.crown === c" @click="f.crown = c"><Crown :v="Number(c)" size="sm" />{{ L(CROWNS[c].zh, CROWNS[c].ja) }}</button>
          </div>
        </div>
        <div class="selects">
          <select v-model="f.rank" class="select" :aria-label="L('评价', '評価')">
            <option value="all">{{ L('全部评价', 'すべての評価') }}</option>
            <option v-for="r in RANK_OPTS" :key="r" :value="r">{{ L(RANKS[r].zh, RANKS[r].ja) }}</option>
            <option value="none">{{ L('没有评价', '評価なし') }}</option>
          </select>
          <select v-model="f.flag" class="select" :aria-label="L('标记', 'マーク')">
            <option value="all">{{ L('全部来源', 'すべて') }}</option>
            <option value="manual">{{ L('手动修改', '手動編集') }}</option>
            <option value="locked">{{ L('已锁定', 'ロック中') }}</option>
          </select>
        </div>
      </div>

      <p class="count t-small" aria-live="polite">
        <template v-if="filtered">{{ L(`符合条件 ${fmt(rows.length)} / ${fmt(totals.n)} 条`, `${fmt(rows.length)} / ${fmt(totals.n)} 件`) }}</template>
        <template v-else>{{ L(`共 ${fmt(totals.n)} 条`, `全 ${fmt(totals.n)} 件`) }}</template>
      </p>

      <div v-if="!rows.length" class="panel">
        <EmptyLane :title="L('没有符合条件的成绩', '条件に合う記録がありません')">
          <button class="btn" @click="clearFilters">{{ L('清除筛选', '絞り込みをクリア') }}</button>
        </EmptyLane>
      </div>

      <div v-else-if="!isMobile" class="hs" :class="{ 'hs-more': moreRight }">
      <div ref="tableWrap" class="panel twrap" :class="{ overflow }">
        <table class="dt dt-compact st" :style="{ '--row-h': rowH + 'px' }">
          <caption class="sr-only">{{ L('全部成绩', '全成績') }}</caption>
          <thead>
            <tr>
              <th scope="col" class="c-song" :class="{ 'dt-sticky-col': overflow }">{{ L('歌曲', '楽曲') }}</th>
              <th v-for="c in COLS" :key="c.key" scope="col" :class="c.cls" :aria-sort="ariaSort(c.key)">
                <button type="button" @click="sortBy(c.key)">
                  {{ L(c.zh, c.ja) }}<Icon v-if="f.sort === c.key" :name="f.dir === 'asc' ? 'chevU' : 'chevD'" :size="12" />
                </button>
              </th>
              <th scope="col" class="c-ops"><span class="sr-only">{{ L('操作', '操作') }}</span></th>
            </tr>
          </thead>
          <VirtualList v-slot="{ item: s }" tag="tbody" row-tag="tr" :items="rows" :row-height="rowH" key-field="key" :colspan="12" :row-class="rowClass">
            <td class="c-song" :class="{ 'dt-sticky-col': overflow }">
              <RouterLink :to="songLink(s)" class="slink"><SongCell :song="songById[s.songId]" size="sm" /></RouterLink>
            </td>
            <td class="c-diff"><Diff :d="s.d" :star="s.star" :constant="s.constant" short show-missing /></td>
            <td class="r num sc">{{ fmt(s.score) }}<template v-if="s.manual"><Icon name="edit" :size="12" class="mk" /><span class="sr-only">{{ L('手动修改', '手動編集') }}</span></template></td>
            <td class="r num c-good">{{ s.good }}</td>
            <td class="r num c-ok">{{ s.ok }}</td>
            <td class="r num" :class="{ zero: s.ng === 0 }">{{ s.ng }}</td>
            <td class="r num c-combo">{{ s.combo }}</td>
            <td class="c"><Crown :v="s.crown" /></td>
            <td class="c"><Rank :v="s.rank" /></td>
            <td class="r num c-plays">{{ s.plays }}</td>
            <td class="r when">{{ when(s.daysAgo) }}</td>
            <td class="r c-ops">
              <template v-if="coarse">
                <template v-if="s.locked"><Icon name="lock" :size="14" class="lk" /><span class="sr-only">{{ L('已锁定', 'ロック中') }}</span></template>
                <button class="icon-btn ob" :aria-label="L(`更多操作：${songTitle(songById[s.songId])}`, `その他の操作：${songTitle(songById[s.songId])}`)" @click="openEdit(s)"><Icon name="more" :size="18" /></button>
              </template>
              <template v-else>
                <button
                  class="icon-btn ob lockbtn"
                  :aria-pressed="s.locked"
                  :aria-label="L(`锁定：${songTitle(songById[s.songId])}`, `ロック：${songTitle(songById[s.songId])}`)"
                  :title="s.locked ? L('已锁定，同步不会覆盖', 'ロック中：同期で上書きされません') : L('锁定这条成绩', 'この記録をロック')"
                  @click="toggleLock(s)"
                >
                  <Icon name="lock" :size="16" />
                </button>
                <button class="icon-btn ob" :aria-label="L(`修改：${songTitle(songById[s.songId])}`, `編集：${songTitle(songById[s.songId])}`)" :title="L('修改', '編集')" @click="openEdit(s)"><Icon name="edit" :size="16" /></button>
                <button class="icon-btn ob" :aria-label="L(`删除：${songTitle(songById[s.songId])}`, `削除：${songTitle(songById[s.songId])}`)" :title="L('删除', '削除')" @click="confirmDel = s"><Icon name="trash" :size="16" /></button>
              </template>
            </td>
          </VirtualList>
        </table>
      </div>
      </div>

      <VirtualList v-else v-slot="{ item: s }" class="mlist" :items="rows" :row-height="68" key-field="key">
        <button class="mrow" @click="openEdit(s)">
          <Cover :song="songById[s.songId]" />
          <span class="grow">
            <b class="title-1l mt" :title="songTitle(songById[s.songId])">{{ songTitle(songById[s.songId]) }}</b>
            <span class="row" style="gap: 8px; margin-top: 4px">
              <Diff :d="s.d" :star="s.star" short />
              <span class="t-caption num">{{ s.good }} / {{ s.ok }} / {{ s.ng }}</span>
              <Icon v-if="s.locked" name="lock" :size="12" />
            </span>
          </span>
          <span class="mright">
            <b class="num">{{ fmt(s.score) }}</b>
            <span class="row" style="gap: 6px"><Crown :v="s.crown" size="sm" /><Rank :v="s.rank" /></span>
          </span>
        </button>
      </VirtualList>
    </template>

    <Sheet :open="!!editing" :title="editing?.new ? L('补录一条成绩', '記録を手動で追加') : L('修改成绩', '記録を編集')" :width="460" @close="editing = null">
      <form v-if="editing" class="col" style="gap: 14px" @submit.prevent="save">
        <div class="esong">
          <Cover :song="songById[editing.songId]" />
          <b class="grow title-1l" :title="songTitle(songById[editing.songId])">{{ songTitle(songById[editing.songId]) }}</b>
          <Diff :d="editing.d" short />
        </div>
        <div v-if="!editing.new" class="elinks">
          <RouterLink :to="songLink(editing)" class="link" @click="editing = null">{{ L('打开歌曲页', '楽曲ページを開く') }}</RouterLink>
        </div>
        <div class="field"><label for="e-score">{{ L('成绩', 'スコア') }}</label><input id="e-score" v-model="editing.score" class="input num" inputmode="numeric" /></div>
        <div class="tri">
          <div class="field"><label for="e-g">{{ L('良', '良') }}</label><input id="e-g" v-model="editing.good" class="input num" inputmode="numeric" /></div>
          <div class="field"><label for="e-o">{{ L('可', '可') }}</label><input id="e-o" v-model="editing.ok" class="input num" inputmode="numeric" /></div>
          <div class="field"><label for="e-n">{{ L('不可', '不可') }}</label><input id="e-n" v-model="editing.ng" class="input num" inputmode="numeric" /></div>
        </div>
        <label class="check"><input v-model="editing.locked" type="checkbox" />{{ L('锁定：之后的同步不会覆盖这条成绩', 'ロック：今後の同期で上書きしない') }}</label>
        <p class="field-hint">{{ L('手动修改的成绩会被标记，不进入全站排名。', '手動で編集した記録にはマークが付き、全体ランキングには含まれません。') }}</p>
      </form>
      <template #foot>
        <button v-if="editing && !editing.new" class="btn btn-danger del" @click="askDelete">{{ L('删除', '削除') }}</button>
        <button class="btn" @click="editing = null">{{ L('取消', 'キャンセル') }}</button>
        <button class="btn btn-primary" @click="save">{{ L('保存修改', '変更を保存') }}</button>
      </template>
    </Sheet>

    <Sheet :open="importOpen" :title="L('导入成绩', '成績をインポート')" :width="480" @close="importOpen = false">
      <div class="drop">
        <Icon name="upload" :size="28" />
        <b>{{ L('把成绩文件拖到这里', 'ここにファイルをドロップ') }}</b>
        <span class="t-small">{{ L('支持 Donder Hiroba 导出的 JSON、菌菌控制台导出的 CSV', 'Donder Hiroba の JSON、Kinoko の CSV に対応') }}</span>
        <button class="btn btn-sm">{{ L('选择文件', 'ファイルを選択') }}</button>
      </div>
      <label class="check"><input type="checkbox" checked />{{ L('只在新成绩更高时覆盖', 'スコアが高い場合のみ上書き') }}</label>
      <template #foot><button class="btn" @click="importOpen = false">{{ L('取消', 'キャンセル') }}</button><button class="btn btn-primary" disabled>{{ L('开始导入', 'インポート開始') }}</button></template>
    </Sheet>

    <Sheet :open="!!confirmDel" :title="L('删除这条成绩？', 'この記録を削除しますか？')" :width="420" @close="confirmDel = null">
      <p v-if="confirmDel">{{ L(`「${songTitle(songById[confirmDel.songId])}」的最好成绩 ${fmt(confirmDel.score)} 会从 Viewer 移除。游戏里的成绩不受影响，下次同步会重新写入。`, `「${songTitle(songById[confirmDel.songId])}」の記録 ${fmt(confirmDel.score)} を Viewer から削除します。ゲーム内の記録には影響せず、次回の同期で再び書き込まれます。`) }}</p>
      <template #foot><button class="btn" @click="confirmDel = null">{{ L('保留', '残す') }}</button><button class="btn btn-danger" @click="remove">{{ L('删除成绩', '記録を削除') }}</button></template>
    </Sheet>
  </div>
</template>

<style scoped>
.summary {
  display: flex;
  align-items: flex-end;
  gap: 36px;
  flex-wrap: wrap;
  margin-bottom: 24px;
}
.bind {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 300px;
}
.acts {
  display: flex;
  gap: 8px;
  margin-left: auto;
}
.toolbar {
  display: flex;
  gap: 12px 16px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.search {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 240px;
  height: var(--ctl-h);
  padding: 0 12px;
  background: var(--surface);
  border: 1px solid var(--ctl-border);
  border-radius: var(--ctl-radius);
  color: var(--ink-3);
  flex: none;
}
.search:focus-within {
  border-color: var(--ka);
  box-shadow: var(--focus);
}
.sinput {
  flex: 1;
  min-width: 0;
  border: 0;
  background: none;
  height: 100%;
  color: var(--ink);
}
.sinput:focus-visible {
  box-shadow: none;
}
.chips {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.cgroup {
  display: flex;
  gap: 8px;
  flex: none;
}
.sep {
  width: 1px;
  height: 20px;
  background: var(--line-strong);
  flex: none;
}
.selects {
  display: flex;
  gap: 8px;
}
.selects .select {
  width: auto;
  min-width: 120px;
}
.count {
  margin-bottom: 10px;
}

/* 表格：吸顶表头、紧凑行；行高 --row-h（舒适 48px / 紧凑 40px，虚拟列表按行高计算） */
.dt th {
  top: var(--bar-h);
}
.dt th:first-child {
  border-top-left-radius: var(--r-panel);
}
.dt th:last-child {
  border-top-right-radius: var(--r-panel);
}
.st td {
  height: var(--row-h, 48px);
  padding-top: 0;
  padding-bottom: 0;
  white-space: nowrap;
  box-sizing: border-box;
}
.c-song {
  max-width: 0;
  width: 26%;
}
.slink {
  display: block;
  min-width: 0;
}
.slink:hover :deep(.t) {
  color: var(--ka-ink);
}
.sc {
  font-size: var(--fs-14);
  font-weight: 700;
}
.mk {
  margin-left: 4px;
  vertical-align: -1px;
  color: var(--ink-3);
}
.zero {
  color: var(--ink-3);
}
.when {
  color: var(--ink-2);
}
.c-ops {
  width: 112px;
  padding-right: 6px !important;
  white-space: nowrap;
}
.ob {
  width: 30px;
  height: 30px;
  color: var(--ink-3);
  opacity: 0;
}
/* 悬停、键盘聚焦到这一行、已锁定时显示 */
tr:hover .ob,
tr:focus-within .ob,
.ob:focus-visible,
tr.is-locked .lockbtn {
  opacity: 1;
}
tr.is-locked .lockbtn {
  color: var(--roll-ink);
}
.lk {
  margin-right: 4px;
  vertical-align: middle;
  color: var(--roll-ink);
}
@media (hover: none) {
  .ob {
    opacity: 1;
  }
}
/* 列优先级（V11）：1100–1239 隐藏次数与连击；768–1099 再隐藏良与可 */
@media (max-width: 1239px) {
  .c-plays,
  .c-combo {
    display: none;
  }
}
@media (max-width: 1099px) {
  .c-good,
  .c-ok {
    display: none;
  }
  /* 仍放不下时：表格内部横滑，首列固定（.dt-sticky-col，由 useHScroll 判断是否溢出） */
  .twrap {
    overflow-x: auto;
  }
  .twrap.overflow .dt th {
    top: 0;
  }
  .st {
    min-width: 680px;
  }
  .c-song {
    width: 220px;
    max-width: 220px;
  }
}
.esong {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--line);
}
.elinks {
  font-size: var(--fs-13);
}
.tri {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.input.num {
  font-size: var(--fs-18);
}
.del {
  margin-right: auto;
}
.drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px 20px;
  border: 2px dashed var(--line-strong);
  border-radius: var(--r-panel);
  text-align: center;
  color: var(--ink-2);
}
.check {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  font-size: var(--fs-13);
}
.check input {
  width: 16px;
  height: 16px;
  accent-color: var(--don);
}
@media (max-width: 767px) {
  .summary {
    gap: 16px 24px;
  }
  .bind {
    width: 100%;
  }
  .acts {
    width: 100%;
    margin: 0;
  }
  .acts .btn {
    flex: 1;
  }
  .toolbar {
    flex-direction: column;
    /* 单列：不换行，否则多行列向 flex 的行宽取最宽子项（筛选胶囊）的内容宽，整页横向溢出 */
    flex-wrap: nowrap;
    align-items: stretch;
    gap: 10px;
  }
  .search {
    width: 100%;
    height: var(--hit);
  }
  .sinput {
    font-size: 16px;
  }
  .chips {
    /* D7：上下各留 3px，横滑容器才不会裁掉胶囊的 44px 扩展区（版面位置不变） */
    margin: -3px calc(var(--gutter) * -1);
    padding: 3px var(--gutter);
  }
  .selects .select {
    flex: 1;
    min-width: 0;
    height: var(--hit);
  }
  .check {
    min-height: var(--hit);
  }
  .mlist {
    display: block;
    border-top: 1px solid var(--line-strong);
  }
  .mrow {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    height: 100%;
    padding: 0;
    border-bottom: 1px solid var(--line);
    text-align: left;
  }
  .mt {
    line-height: 1.3;
  }
  .mright {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
    flex: none;
  }
  .mright b {
    font-size: var(--fs-18);
  }
}
</style>
