<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import Icon from '../components/Icon.vue'
import SongCell from '../components/SongCell.vue'
import Diff from '../components/Diff.vue'
import Crown from '../components/Crown.vue'
import DrumDial from '../components/DrumDial.vue'
import { songs, songById, scoreOf, fmt, fx } from '../mock/data'
import { L, isReady } from '../store'

const DIFF_NAMES = { 3: ['困难', 'むずかしい'], 4: ['魔王', 'おに'], 5: ['里', '裏'] }
const FIELDS = [
  { key: 'good', zh: '良', ja: '良' },
  { key: 'ok', zh: '可', ja: '可' },
  { key: 'ng', zh: '不可', ja: '不可' },
]
const KEYS = FIELDS.map((f) => f.key)

/* ---------- 选歌 ---------- */
const songId = ref(615)
const d = ref(4)
const song = computed(() => songById[songId.value])
const charts = computed(() => song.value.charts.filter((c) => c.constant != null))
const chart = computed(() => charts.value.find((c) => c.d === d.value) || charts.value[charts.value.length - 1])
const notes = computed(() => chart.value.notes)
const mine = computed(() => (isReady.value ? scoreOf(songId.value, chart.value.d) || null : null))

const picker = ref(null)
const kwInput = ref(null)
const pickerOpen = ref(false)
const kw = ref('')
const options = computed(() => {
  const k = kw.value.trim().toLowerCase()
  return songs.filter((s) => !k || `${s.ja} ${s.zh} ${s.artist} ${s.id}`.toLowerCase().includes(k))
})
function togglePicker() {
  pickerOpen.value = !pickerOpen.value
  if (pickerOpen.value) nextTick(() => kwInput.value?.focus())
}
function choose(s) {
  songId.value = s.id
  if (!s.charts.some((c) => c.d === d.value && c.constant != null)) d.value = 4
  pickerOpen.value = false
  kw.value = ''
}
function onDoc(e) {
  if (pickerOpen.value && picker.value && !picker.value.contains(e.target)) pickerOpen.value = false
}
function onKey(e) {
  if (e.key === 'Escape') pickerOpen.value = false
}
onMounted(() => {
  document.addEventListener('pointerdown', onDoc)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDoc)
  document.removeEventListener('keydown', onKey)
})

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
watch(() => [songId.value, chart.value.d, isReady.value], () => (mine.value ? fillMine() : clearAll()), { immediate: true })

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
const rt = computed(() => (valid.value ? rtOf(n(v.good), n(v.ok)) : null))
const below = computed(() => acc.value != null && acc.value < 0.75)
const pct = (k) => (total.value ? (n(v[k]) / Math.max(total.value, notes.value)) * 100 + '%' : '0%')
const delta = (x) => (x < 0.005 ? L('不到 0.01', '0.01 未満') : `+${x.toFixed(2)}`)

const whatIfs = computed(() => {
  if (!valid.value) return []
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
          <span class="field-label">{{ L('歌曲', '楽曲') }}</span>
          <button class="pick-btn" :aria-expanded="pickerOpen" aria-haspopup="true" @click="togglePicker">
            <SongCell :song="song" class="grow" />
            <Icon :name="pickerOpen ? 'chevU' : 'chevD'" :size="18" />
          </button>
          <div v-if="pickerOpen" class="pop">
            <label class="pop-search">
              <Icon name="search" :size="16" />
              <input ref="kwInput" v-model="kw" class="input" type="search" :placeholder="L('搜索曲名、曲师或 ID', '曲名・アーティスト・ID で検索')" :aria-label="L('搜索歌曲', '楽曲を検索')" />
            </label>
            <ul class="opts">
              <li v-for="s in options" :key="s.id">
                <button :aria-current="s.id === songId ? 'true' : undefined" @click="choose(s)">
                  <SongCell :song="s" size="sm" class="grow" />
                  <Diff :d="4" :star="s.levels[3]" short />
                </button>
              </li>
              <li v-if="!options.length" class="t-small none">{{ L(`没有找到「${kw}」`, `「${kw}」は見つかりません`) }}</li>
            </ul>
          </div>
        </div>

        <div class="field">
          <span class="field-label">{{ L('难度', '難易度') }}</span>
          <div class="seg" role="group" :aria-label="L('难度', '難易度')">
            <button v-for="c in charts" :key="c.d" :aria-pressed="chart.d === c.d" @click="d = c.d">
              {{ L(...DIFF_NAMES[c.d]) }} ★{{ c.star }}<span class="num k">{{ fx(c.constant) }}</span>
            </button>
          </div>
        </div>

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
            <b class="num big">{{ rt == null ? '—' : rt.toFixed(2) }}</b>
            <span class="t-caption">{{ L('定数', '定数') }} <span class="num">{{ fx(chart.constant) }}</span></span>
          </DrumDial>
          <dl class="res-kv">
            <div>
              <dt>{{ L('准确率', '精度') }}</dt>
              <dd class="num">{{ acc == null ? '—' : (acc * 100).toFixed(2) + '%' }}</dd>
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

        <template v-if="valid">
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
        <p v-else class="t-small wi-h">{{ L('填好良、可、不可后，这里显示这一局的单曲 RT。', '良・可・不可を入力すると、このプレイの単曲 RT が表示されます。') }}</p>
      </section>
    </div>

    <!-- 手机：结果贴底 -->
    <div class="mbar only-mobile">
      <div class="mbar-in">
        <span class="mb-rt"><small>{{ L('单曲 RT', '単曲 RT') }}</small><b class="num">{{ rt == null ? '—' : rt.toFixed(2) }}</b></span>
        <span class="mb-acc"><small>{{ below ? L('低于 75%，不计入', '75% 未満・対象外') : L('准确率', '精度') }}</small><b class="num">{{ acc == null ? '—' : (acc * 100).toFixed(2) + '%' }}</b></span>
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
  border: 1px solid var(--line-strong);
  border-radius: var(--r-ctl);
  background: var(--surface);
  text-align: left;
  color: var(--ink-3);
  transition: border-color var(--dur-1);
}
.pick-btn:hover,
.pick-btn[aria-expanded='true'] {
  border-color: var(--ink-3);
}
.pop {
  position: absolute;
  z-index: 5;
  left: 0;
  right: 0;
  top: calc(100% + 6px);
  padding: 8px;
  background: var(--surface);
  border-radius: var(--r-panel);
  box-shadow: var(--shadow-pop);
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
.opts button {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 6px 8px;
  border-radius: var(--r-ctl);
  text-align: left;
}
.opts button:hover {
  background: var(--bg-sunk);
}
.opts button[aria-current='true'] {
  background: var(--ka-wash);
}
.opts .none {
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
    opacity: 0.7;
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
