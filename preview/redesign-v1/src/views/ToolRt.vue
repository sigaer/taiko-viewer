<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import Icon from '../components/Icon.vue'
import SongCell from '../components/SongCell.vue'
import Crown from '../components/Crown.vue'
import DrumDial from '../components/DrumDial.vue'
import { songs, songById, scoreOf, fmt, fx } from '../mock/data'
import { L, isReady, store, ensureSearch, recentIds } from '../store'
import { searchSongs } from '../search'
import { useQueryState } from '../routeState'

const DIFF_NAMES = { 1: ['简单', 'かんたん'], 2: ['普通', 'ふつう'], 3: ['困难', 'むずかしい'], 4: ['魔王', 'おに'], 5: ['里', '裏'] }
const FIELDS = [
  { key: 'good', zh: '良', ja: '良' },
  { key: 'ok', zh: '可', ja: '可' },
  { key: 'ng', zh: '不可', ja: '不可' },
]
const KEYS = FIELDS.map((f) => f.key)

/* ---------- 选歌：?song=&d=（命令面板「用 RT 计算器算〈曲名〉」带进来） ---------- */
ensureSearch()
const q = useQueryState({
  song: { type: 'number', default: 615 },
  d: { type: 'number', default: 4 },
})
const song = computed(() => songById[q.song] || songById[615] || songs[0])
const charts = computed(() => song.value.charts.filter((c) => c.d >= 3))
const chart = computed(() => charts.value.find((c) => c.d === q.d) || charts.value.find((c) => c.d === 4) || charts.value[charts.value.length - 1])
const hasConst = computed(() => chart.value?.constant != null)
const notes = computed(() => chart.value?.notes ?? 0)
const mine = computed(() => (isReady.value ? scoreOf(song.value.id, chart.value.d) || null : null))

const picker = ref(null)
const pickBtn = ref(null)
const kwInput = ref(null)
const listEl = ref(null)
const pickerOpen = ref(false)
const kw = ref('')
const active = ref(0)
const results = computed(() => {
  const k = kw.value.trim()
  if (!k) return { items: recentIds.value.map((id) => songById[id]).filter(Boolean).slice(0, 8), total: 0, recent: true }
  const r = searchSongs(k, 8, { locale: store.locale })
  return { items: r.items.map((x) => x.song), total: r.total, recent: false }
})
watch(results, () => (active.value = 0))
const optId = (i) => `rt-opt-${i}`
function togglePicker() {
  pickerOpen.value = !pickerOpen.value
  if (pickerOpen.value) nextTick(() => kwInput.value?.focus())
}
function closePicker(refocus = true) {
  pickerOpen.value = false
  kw.value = ''
  if (refocus) nextTick(() => pickBtn.value?.focus())
}
function choose(s) {
  const d = s.charts.some((c) => c.d === q.d) ? q.d : s.charts.some((c) => c.d === 4) ? 4 : Math.max(...s.charts.map((c) => c.d))
  Object.assign(q, { song: s.id, d })
  closePicker()
}
function onKw(e) {
  const n = results.value.items.length
  if (e.key === 'ArrowDown' && n) {
    e.preventDefault()
    active.value = (active.value + 1) % n
  } else if (e.key === 'ArrowUp' && n) {
    e.preventDefault()
    active.value = (active.value - 1 + n) % n
  } else if (e.key === 'Enter' && n) {
    e.preventDefault()
    choose(results.value.items[active.value])
  } else if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    closePicker()
    return
  } else return
  nextTick(() => listEl.value?.querySelector(`#${optId(active.value)}`)?.scrollIntoView({ block: 'nearest' }))
}
function onDoc(e) {
  if (pickerOpen.value && picker.value && !picker.value.contains(e.target)) closePicker(false)
}
onMounted(() => document.addEventListener('pointerdown', onDoc))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDoc))

/* ---------- 良 / 可 / 不可：填两项，第三项自动补齐 ---------- */
const v = reactive({ good: '', ok: '', ng: '' })
const auto = ref(null)
let order = []
const n = (x) => (x === '' || x == null ? 0 : Number(x))

function setVal(k, raw) {
  v[k] = raw === '' ? '' : Math.max(0, Math.floor(Number(raw) || 0))
  order = order.filter((x) => x !== k)
  if (v[k] !== '') order.push(k)
  if (auto.value === k) auto.value = null
  if (order.length >= 2) {
    const [a, b] = order.slice(-2)
    const third = KEYS.find((x) => x !== a && x !== b)
    v[third] = Math.max(0, notes.value - n(v[a]) - n(v[b]))
    auto.value = third
    order = [a, b]
  }
}
function clearAll() {
  v.good = v.ok = v.ng = ''
  order = []
  auto.value = null
}
function fillMine() {
  if (!mine.value) return
  v.good = mine.value.good
  v.ok = mine.value.ok
  v.ng = mine.value.ng
  order = ['good', 'ok']
  auto.value = null
}
watch(() => [song.value.id, chart.value.d, isReady.value], () => (mine.value ? fillMine() : clearAll()), { immediate: true })

const filled = computed(() => KEYS.filter((k) => v[k] !== '').length)
const total = computed(() => n(v.good) + n(v.ok) + n(v.ng))
const over = computed(() => total.value > notes.value)
const short = computed(() => filled.value === 3 && total.value < notes.value)
const valid = computed(() => filled.value === 3 && total.value === notes.value)

/* ---------- 计算 ---------- */
function rtOf(good, ok) {
  const acc = (good + 0.5 * ok) / notes.value
  if (acc < 0.75) return 0
  return chart.value.constant * (0.62 + 0.38 * Math.pow((acc - 0.75) / 0.25, 1.6)) + (acc > 0.985 ? 0.25 : 0)
}
const acc = computed(() => (valid.value ? (n(v.good) + 0.5 * n(v.ok)) / notes.value : null))
const rt = computed(() => (valid.value && hasConst.value ? rtOf(n(v.good), n(v.ok)) : null))
const below = computed(() => acc.value != null && acc.value < 0.75)
const pct = (k) => (total.value ? (n(v[k]) / Math.max(total.value, notes.value)) * 100 + '%' : '0%')
const delta = (x) => (x < 0.005 ? L('不到 0.01', '0.01 未満') : `+${x.toFixed(2)}`)

const whatIfs = computed(() => {
  if (!valid.value || rt.value == null) return []
  const g = n(v.good)
  const o = n(v.ok)
  const ng = n(v.ng)
  const rows = []
  const add = (key, label, good, ok) => {
    const next = rtOf(good, ok)
    rows.push({ key, label, rt: next, delta: next - rt.value })
  }
  if (ng > 0) add('ng1', L('再少 1 个不可', '不可をあと 1 つ減らす'), g + 1, o)
  if (o > 0) {
    const k = Math.min(5, o)
    add('ok', L(`${k} 个可变成良`, `可 ${k} 個を良に`), g + k, o - k)
  }
  if (ng > 0) add('fc', L('全连（不可都变成可）', 'フルコンボ（不可をすべて可に）'), g, o + ng)
  if (ng > 0 || o > 0) add('dfc', L('全良', '全良'), notes.value, 0)
  return rows
})
</script>

<template>
  <div class="page rt">
    <div class="grid">
      <!-- 输入 -->
      <section class="panel form">
        <div ref="picker" class="field picker">
          <span id="rt-song-label" class="field-label">{{ L('歌曲', '楽曲') }}</span>
          <button ref="pickBtn" class="pick-btn" :aria-expanded="pickerOpen" aria-haspopup="listbox" aria-labelledby="rt-song-label rt-song-now" @click="togglePicker">
            <span id="rt-song-now" class="grow"><SongCell :song="song" /></span>
            <Icon :name="pickerOpen ? 'chevU' : 'chevD'" :size="18" />
          </button>
          <div v-if="pickerOpen" class="pop">
            <div class="pop-search">
              <Icon name="search" :size="16" />
              <input
                ref="kwInput"
                v-model="kw"
                class="input"
                type="search"
                role="combobox"
                aria-autocomplete="list"
                :aria-expanded="results.items.length > 0"
                aria-controls="rt-song-list"
                :aria-activedescendant="results.items.length ? optId(active) : undefined"
                :placeholder="L('曲名、别名、曲师或 ID', '曲名・別名・アーティスト・ID')"
                :aria-label="L('搜索歌曲', '楽曲を検索')"
                autocomplete="off"
                spellcheck="false"
                @keydown="onKw"
              />
            </div>
            <p v-if="results.recent && results.items.length" class="t-caption opts-h">{{ L('最近看过', '最近見た曲') }}</p>
            <ul id="rt-song-list" ref="listEl" class="opts" role="listbox" :aria-label="L('歌曲', '楽曲')">
              <li
                v-for="(s, i) in results.items"
                :id="optId(i)"
                :key="s.id"
                role="option"
                class="opt"
                :class="{ act: i === active }"
                :aria-selected="i === active"
                @mousemove="active = i"
                @click="choose(s)"
              >
                <SongCell :song="s" size="sm" class="grow" />
                <span v-if="s.id === song.id" class="cur"><Icon name="check" :size="16" /><span class="sr-only">{{ L('当前', '選択中') }}</span></span>
              </li>
            </ul>
            <p v-if="!results.recent && !results.items.length" class="t-small none" role="status">{{ L(`没有找到「${kw}」`, `「${kw}」は見つかりません`) }}</p>
            <p v-else-if="results.total > results.items.length" class="t-caption opts-f">{{ L(`共 ${fmt(results.total)} 首，继续输入可以缩小范围`, `全 ${fmt(results.total)} 曲。続けて入力すると絞り込めます`) }}</p>
          </div>
        </div>

        <div class="field">
          <span class="field-label">{{ L('难度', '難易度') }}</span>
          <div class="seg" role="group" :aria-label="L('难度', '難易度')">
            <button v-for="c in charts" :key="c.d" :aria-pressed="chart.d === c.d" @click="q.d = c.d">
              {{ L(...DIFF_NAMES[c.d]) }} ★{{ c.star }}<span v-if="c.constant != null" class="num k">{{ fx(c.constant) }}</span><span v-else class="k na">—</span>
            </button>
          </div>
        </div>
        <p v-if="!hasConst" class="state" role="status"><Icon name="info" :size="18" />{{ L('这个难度还没有定数，无法计算 RT', 'この難易度はまだ定数がないため、RT を計算できません') }}</p>

        <div>
          <div class="judge-in">
            <div v-for="f in FIELDS" :key="f.key" class="field">
              <label :for="`rt-${f.key}`"><i class="jdot" :class="f.key" />{{ L(f.zh, f.ja) }}<span v-if="auto === f.key" class="tag">{{ L('自动', '自動') }}</span></label>
              <input
                :id="`rt-${f.key}`"
                class="input num"
                :class="{ 'is-error': over || short }"
                type="number"
                inputmode="numeric"
                min="0"
                :max="notes"
                placeholder="0"
                :value="v[f.key]"
                @input="setVal(f.key, $event.target.value)"
              />
            </div>
          </div>
          <p v-if="over" class="field-error msg" role="alert">{{ L(`三项合计 ${fmt(total)}，超过了这张谱面的物量 ${fmt(notes)}。`, `合計 ${fmt(total)} は、この譜面のノーツ数 ${fmt(notes)} を超えています。`) }}</p>
          <p v-else-if="short" class="field-error msg" role="alert">{{ L(`三项合计 ${fmt(total)}，比物量 ${fmt(notes)} 少 ${fmt(notes - total)}。`, `合計 ${fmt(total)}。ノーツ数 ${fmt(notes)} に ${fmt(notes - total)} 足りません。`) }}</p>
          <p v-else-if="!valid" class="field-hint msg">{{ L(`物量 ${fmt(notes)}。填两项，第三项会自动补齐。`, `ノーツ数 ${fmt(notes)}。2 つ入力すると残りは自動で入ります。`) }}</p>
          <p v-else class="field-hint msg">{{ L('合计', '合計') }} <span class="num">{{ fmt(total) }} / {{ fmt(notes) }}</span></p>
        </div>

        <div class="acts">
          <button v-if="isReady" class="btn" :disabled="!mine" @click="fillMine"><Icon name="download" :size="16" />{{ L('填入我的最好成绩', '自己ベストを入力') }}</button>
          <button class="btn btn-ghost" :disabled="!filled" @click="clearAll">{{ L('清空', 'クリア') }}</button>
          <span v-if="isReady && mine" class="mine t-caption"><Crown :v="mine.crown" size="sm" /><span class="num">{{ fmt(mine.score) }}</span></span>
          <span v-else-if="isReady" class="mine t-caption">{{ L('这张谱面还没有成绩', 'この譜面の記録はまだありません') }}</span>
        </div>
      </section>

      <!-- 结果 -->
      <section class="panel result" aria-live="polite">
        <div class="res-top">
          <DrumDial :value="rt ?? 0" :size="208">
            <span class="t-caption">{{ L('单曲 RT', '単曲 RT') }}</span>
            <b v-if="rt != null" class="num big">{{ rt.toFixed(2) }}</b>
            <b v-else class="big na">—</b>
            <span class="t-caption">{{ L('定数', '定数') }} <span v-if="hasConst" class="num">{{ fx(chart.constant) }}</span><span v-else class="na">—</span></span>
          </DrumDial>
          <dl class="res-kv">
            <div>
              <dt>{{ L('准确率', '精度') }}</dt>
              <dd v-if="acc != null" class="num">{{ (acc * 100).toFixed(2) }}%</dd>
              <dd v-else class="na">—</dd>
            </div>
            <div>
              <dt>{{ L('物量', 'ノーツ数') }}</dt>
              <dd class="num">{{ fmt(notes) }}</dd>
            </div>
          </dl>
        </div>

        <p v-if="below" class="state"><Icon name="warn" :size="18" />{{ L('准确率低于 75% 不计入 Rating', '精度 75% 未満は Rating に反映されません') }}</p>

        <div class="judge-box">
          <div class="judge" role="img" :aria-label="`${L('良', '良')} ${n(v.good)} / ${L('可', '可')} ${n(v.ok)} / ${L('不可', '不可')} ${n(v.ng)}`">
            <i class="g" :style="{ width: pct('good') }" /><i class="o" :style="{ width: pct('ok') }" /><i class="n" :style="{ width: pct('ng') }" />
          </div>
          <div class="judge-legend">
            <span v-for="f in FIELDS" :key="f.key"><i class="jdot" :class="f.key" />{{ L(f.zh, f.ja) }}<b>{{ fmt(n(v[f.key])) }}</b></span>
          </div>
        </div>

        <template v-if="valid && hasConst">
          <h2 class="t-h3 wi-h">{{ L('如果再好一点', 'もう少し良くなると') }}</h2>
          <ul v-if="whatIfs.length" class="whatif">
            <li v-for="w in whatIfs" :key="w.key">
              <span class="grow">{{ w.label }}</span>
              <span class="t-caption">RT</span>
              <b class="num">{{ w.rt.toFixed(2) }}</b>
              <span class="num wd" :class="{ up: w.delta >= 0.005 }">{{ delta(w.delta) }}</span>
            </li>
          </ul>
          <p v-else class="t-small">{{ L('已经是这张谱面的单曲 RT 上限。', 'この譜面の単曲 RT の上限です。') }}</p>
        </template>
        <p v-else-if="hasConst" class="t-small wi-h">{{ L('填好良、可、不可后显示这一局的单曲 RT。', '良・可・不可を入力すると、このプレイの単曲 RT が表示されます。') }}</p>
      </section>
    </div>

    <!-- 手机：结果贴底 -->
    <div class="mbar only-mobile">
      <div class="mbar-in">
        <span class="mb-rt"><small>{{ L('单曲 RT', '単曲 RT') }}</small><b v-if="rt != null" class="num">{{ rt.toFixed(2) }}</b><b v-else class="mb-na">—</b></span>
        <span class="mb-acc"><small>{{ below ? L('低于 75%，不计入', '75% 未満・対象外') : L('准确率', '精度') }}</small><b v-if="acc != null" class="num">{{ (acc * 100).toFixed(2) }}%</b><b v-else class="mb-na">—</b></span>
      </div>
      <div class="judge">
        <i class="g" :style="{ width: pct('good') }" /><i class="o" :style="{ width: pct('ok') }" /><i class="n" :style="{ width: pct('ng') }" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 20px;
  align-items: start;
  max-width: 1120px;
}
.form {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
}

/* ---------- 选歌 ---------- */
.picker {
  position: relative;
}
.pick-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 8px 12px 8px 8px;
  border: 1px solid var(--ctl-border);
  border-radius: var(--ctl-radius);
  background: var(--surface);
  text-align: left;
  color: var(--ink-3);
  transition: border-color var(--dur-1);
}
.pick-btn > .grow {
  min-width: 0;
}
.pick-btn:hover,
.pick-btn[aria-expanded='true'] {
  border-color: var(--ink-2);
}
.pop {
  position: absolute;
  z-index: 5;
  left: 0;
  right: 0;
  top: calc(100% + 6px);
  padding: 8px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--overlay-radius);
  box-shadow: var(--overlay-shadow);
}
.pop-search {
  position: relative;
  display: block;
}
.pop-search svg {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--ink-3);
  pointer-events: none;
}
.pop-search .input {
  padding-left: 36px;
}
.opts {
  max-height: 312px;
  margin-top: 6px;
  overflow-y: auto;
}
.opt {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: var(--ctl-h);
  padding: 6px 8px;
  border-radius: var(--ctl-radius);
  cursor: pointer;
}
.opt.act {
  background: var(--bg-sunk);
}
.cur {
  display: inline-flex;
  color: var(--ka-ink);
}
.opts-h,
.opts-f {
  padding: 8px 8px 0;
}
.none {
  padding: 16px 8px;
}

/* ---------- 输入 ---------- */
.seg {
  align-self: flex-start;
  max-width: 100%;
  overflow-x: auto;
  scrollbar-width: none;
}
.seg .k {
  margin-left: 6px;
  font-size: var(--fs-14);
  color: var(--ink-3);
}
.seg [aria-pressed='true'] .k {
  color: var(--don-ink);
}
.judge-in {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.judge-in label {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 20px;
}
.judge-in .tag {
  margin-left: auto;
}
.judge-in .input {
  height: 52px;
  font-size: var(--fs-22);
}
.jdot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--judge-good);
  flex: none;
}
.jdot.ok {
  background: var(--judge-ok);
}
.jdot.ng {
  background: var(--judge-ng);
}
.msg {
  margin-top: 8px;
}
.acts {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.mine {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}
.mine .num {
  font-size: var(--fs-14);
  color: var(--ink-2);
}

/* ---------- 结果 ---------- */
.result {
  position: sticky;
  top: calc(var(--bar-h) + 16px);
  padding: 24px;
}
.res-top {
  display: flex;
  align-items: center;
  gap: 28px;
}
.big {
  font-size: 56px;
  font-weight: 700;
  line-height: 1;
}
.res-kv {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.res-kv > div {
  display: flex;
  flex-direction: column-reverse;
}
.res-kv dt {
  font-size: var(--fs-12);
  color: var(--ink-3);
}
.res-kv dd {
  font-size: var(--fs-28);
  font-weight: 700;
  line-height: 1.1;
}
.state {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  padding: 10px 12px;
  border-radius: var(--r-ctl);
  background: var(--roll-wash);
  color: var(--roll-ink);
  font-size: var(--fs-13);
  font-weight: 700;
}
.judge-box {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 20px;
}
.judge-legend span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.wi-h {
  margin-top: 22px;
  padding-top: 18px;
  border-top: 1px solid var(--line);
}
.whatif {
  margin-top: 6px;
}
.whatif li {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 9px 0;
  border-bottom: 1px solid var(--line);
  font-size: var(--fs-13);
}
.whatif li:last-child {
  border-bottom: 0;
}
.whatif b {
  font-size: var(--fs-18);
}
.wd {
  min-width: 64px;
  text-align: right;
  font-size: var(--fs-16);
  color: var(--ink-3);
}
.wd.up {
  color: var(--ok);
}

@media (max-width: 1099px) {
  .grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .result {
    position: static;
  }
}
@media (max-width: 767px) {
  .form {
    padding: 16px;
  }
  .result {
    padding: 4px 16px 16px;
  }
  .res-top {
    display: none;
  }
  .judge-box {
    margin-top: 14px;
  }
  .mbar {
    position: sticky;
    bottom: calc(var(--tab-h) + env(safe-area-inset-bottom) + 8px);
    z-index: 10;
    margin-top: 16px;
    padding: 10px 16px 12px;
    border-radius: var(--r-panel);
    background: var(--ink);
    color: var(--bg);
    box-shadow: var(--shadow-lift);
  }
  .mbar-in {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 8px;
  }
  .mbar-in span {
    display: flex;
    flex-direction: column;
    line-height: 1.1;
  }
  .mbar small {
    font-size: var(--fs-11);
    font-weight: 500;
  }
  .mb-na {
    font-weight: 400;
  }
  .opt {
    min-height: var(--hit);
  }
  .mb-rt b {
    font-size: var(--fs-36);
    font-weight: 700;
  }
  .mb-acc {
    align-items: flex-end;
  }
  .mb-acc b {
    font-size: var(--fs-22);
  }
  .mbar .judge {
    height: 6px;
    background: color-mix(in srgb, var(--bg) 22%, transparent);
  }
}
</style>
