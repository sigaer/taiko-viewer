<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import Icon from '../components/Icon.vue'
import Radar from '../components/Radar.vue'
import ChartSheet from '../components/ChartSheet.vue'
import EmptyLane from '../components/EmptyLane.vue'
import { CHART_AXES, fmt, fx } from '../mock/data'
import { L, toast } from '../store'

const MAX_KB = 512
const ENCODINGS = [
  { key: 'auto', zh: '自动', ja: '自動' },
  { key: 'utf8', zh: 'UTF-8', ja: 'UTF-8' },
  { key: 'sjis', zh: 'Shift-JIS', ja: 'Shift-JIS' },
  { key: 'gb18030', zh: 'GB18030', ja: 'GB18030' },
]
const SAMPLE = {
  name: 'seiga-itten-ura.tja',
  kb: 38.4,
  title: '星河一天',
  subtitle: 'cosMo@暴走P',
  bpm: '200',
  offset: '-1.92',
  wave: 'seiga-itten.ogg',
  courses: [
    { key: 'oni', zh: 'Oni', ja: 'Oni', level: 10, notes: 888, measures: 96, constant: 11.21, c75: 11.38, c99: 11.07, density: 0.4, abilities: { stamina: 11.62, handspeed: 10.94, burst: 11.8, complex: 10.41, rhythm: 9.73 } },
    { key: 'edit', zh: 'Edit', ja: 'Edit', level: 10, notes: 1104, measures: 96, constant: 12.9, c75: 13.12, c99: 12.74, density: 0.55, abilities: { stamina: 13.38, handspeed: 12.61, burst: 13.07, complex: 12.2, rhythm: 11.46 } },
    { key: 'tower', zh: '塔', ja: 'タワー', level: 8, notes: 642, measures: 120, constant: 8.46, c75: 8.61, c99: 8.3, density: 0.26, abilities: { stamina: 9.12, handspeed: 7.85, burst: 8.03, complex: 8.4, rhythm: 8.92 } },
    { key: 'dan', zh: '段位', ja: '段位', level: null, notes: 2977, measures: 288, constant: 12.14, c75: 12.33, c99: 11.98, density: 0.47, abilities: { stamina: 13.9, handspeed: 11.7, burst: 11.92, complex: 12.05, rhythm: 11.1 } },
  ],
}

/* ---------- 状态：empty → parsing → result / error ---------- */
const state = ref('empty')
const encoding = ref('auto')
const file = ref(null)
const result = ref(null)
const dragging = ref(false)
const fileInput = ref(null)
let timer = 0

function start(f) {
  file.value = f
  if (f.kb > MAX_KB) {
    state.value = 'error'
    return
  }
  state.value = 'parsing'
  clearTimeout(timer)
  timer = setTimeout(() => {
    result.value = { ...SAMPLE, name: f.name, kb: f.kb }
    courseKey.value = 'oni'
    side.value = 'p1'
    state.value = 'result'
  }, 1200)
}
function onFiles(list) {
  const f = list && list[0]
  if (f) start({ name: f.name, kb: Math.round(f.size / 102.4) / 10 })
}
function onPick(e) {
  onFiles(e.target.files)
  e.target.value = ''
}
function onDrop(e) {
  dragging.value = false
  onFiles(e.dataTransfer?.files)
}
function openFile() {
  fileInput.value?.click()
}
function useSample() {
  start({ name: SAMPLE.name, kb: SAMPLE.kb })
}
function reset() {
  clearTimeout(timer)
  state.value = 'empty'
  file.value = null
  result.value = null
}
onBeforeUnmount(() => clearTimeout(timer))

/* ---------- 结果 ---------- */
const courseKey = ref('oni')
const side = ref('p1')
const course = computed(() => result.value.courses.find((c) => c.key === courseKey.value))
const courseIdx = computed(() => result.value.courses.indexOf(course.value))
const axes = computed(() => CHART_AXES.map((a) => ({ key: a.key, label: L(a.zh, a.ja), value: course.value.abilities[a.key] })))
const encLabel = computed(() => {
  const e = ENCODINGS.find((x) => x.key === encoding.value)
  return encoding.value === 'auto' ? L('UTF-8（自动识别）', 'UTF-8（自動判定）') : L(e.zh, e.ja)
})
const levelText = computed(() => (course.value.level ? `★${course.value.level}` : ''))

// 谱面图预览：共用 ChartSheet；按难度和 P1/P2 取固定种子，同一张图每次渲染都一样
const ROWS = 6
const sheetSeed = computed(() => 4100 + courseIdx.value * 97 + (side.value === 'p2' ? 31 : 0))
const sheetDensity = computed(() => {
  const d = course.value.density
  return Array.from({ length: ROWS * 4 }, (_, i) => Math.max(0.1, Math.min(0.95, d + (((i * 37 + courseIdx.value * 11) % 13) - 6) / 30)))
})
const sheetLabel = computed(() =>
  L(`${result.value.title} ${course.value.zh} 谱面图预览，第 1–${ROWS * 4} 小节`, `${result.value.title} ${course.value.ja} 譜面画像プレビュー、1–${ROWS * 4} 小節`),
)
const radarLabel = computed(() => L(`${course.value.zh} 五项能力值`, `${course.value.ja} の 5 つの能力値`) + '：' + axes.value.map((a) => `${a.label} ${a.value.toFixed(2)}`).join('，'))
function download() {
  const base = result.value.name.replace(/\.tja$/i, '')
  toast(L(`已下载 ${base}-${courseKey.value}-${side.value}.png`, `${base}-${courseKey.value}-${side.value}.png をダウンロードしました`))
}
</script>

<template>
  <div class="page tja">
    <!-- 上传 / 解析中 / 出错 -->
    <section v-if="state !== 'result'" class="panel up">
      <template v-if="state === 'empty'">
        <button class="drop" :class="{ over: dragging }" @click="openFile" @dragover.prevent="dragging = true" @dragleave.prevent="dragging = false" @drop.prevent="onDrop">
          <span class="drop-icon"><Icon name="upload" :size="26" /></span>
          <b>{{ L('把 .tja 文件拖到这里，或点击选择', '.tja ファイルをここにドロップ、またはクリックして選択') }}</b>
          <span class="t-caption">{{ L('单个文件，最大 512 KB', '1 ファイル・最大 512 KB') }}</span>
        </button>
        <input ref="fileInput" type="file" accept=".tja,text/plain" class="sr-only" tabindex="-1" aria-hidden="true" @change="onPick" />
        <div class="up-row">
          <div class="field enc">
            <label for="tja-enc">{{ L('文件编码', '文字コード') }}</label>
            <select id="tja-enc" v-model="encoding" class="select">
              <option v-for="e in ENCODINGS" :key="e.key" :value="e.key">{{ L(e.zh, e.ja) }}</option>
            </select>
          </div>
          <button class="btn" @click="useSample">{{ L('使用示例 TJA', 'サンプル TJA を使う') }}</button>
        </div>
      </template>

      <EmptyLane
        v-else-if="state === 'parsing'"
        tone="loading"
        :title="L(`正在解析 ${file.name}`, `${file.name} を解析中`)"
        :text="L('计算各难度定数，绘制谱面图。', '各コースの定数を計算し、譜面画像を描画しています。')"
      />

      <EmptyLane
        v-else
        tone="error"
        :title="L('文件超过 512 KB', 'ファイルが 512 KB を超えています')"
        :text="L(`${file.name} 有 ${fmt(file.kb)} KB。TJA 是文本文件，通常只有几十 KB，请确认选的不是音频或压缩包。`, `${file.name} は ${fmt(file.kb)} KB あります。TJA はテキストファイルで通常は数十 KB です。音声や圧縮ファイルではないか確認してください。`)"
      >
        <button class="btn btn-primary" @click="reset">{{ L('重新选择文件', 'ファイルを選び直す') }}</button>
      </EmptyLane>
    </section>

    <!-- 结果 -->
    <template v-else>
      <div class="res-head">
        <div class="file">
          <span class="file-icon"><Icon name="music" /></span>
          <div class="grow">
            <b class="truncate">{{ result.name }}</b>
            <span class="t-caption"><span class="num">{{ result.kb }} KB</span> · {{ encLabel }}</span>
          </div>
        </div>
        <button class="btn" @click="reset"><Icon name="upload" :size="16" />{{ L('换一个文件', '別のファイル') }}</button>
      </div>

      <div class="course-row scroll-x">
        <div class="seg" role="group" :aria-label="L('难度', 'コース')">
          <button v-for="c in result.courses" :key="c.key" :aria-pressed="courseKey === c.key" @click="courseKey = c.key">
            {{ L(c.zh, c.ja) }}<span v-if="c.level" class="num lv">★{{ c.level }}</span>
          </button>
        </div>
      </div>

      <div class="layout">
        <div class="left">
          <section class="panel">
            <div class="stats">
              <div class="stat">
                <div class="v">{{ fmt(course.notes) }}</div>
                <div class="k">{{ L('音符数', 'ノーツ数') }}</div>
              </div>
              <div class="stat main">
                <div class="v">{{ fx(course.constant) }}</div>
                <div class="k">{{ L('主定数（95%）', '主定数（95%）') }}</div>
              </div>
              <div class="stat">
                <div class="v">{{ fx(course.c75) }}</div>
                <div class="k">75%</div>
              </div>
              <div class="stat">
                <div class="v">{{ fx(course.c99) }}</div>
                <div class="k">99%</div>
              </div>
            </div>
            <div class="radar">
              <Radar :axes="axes" :domain="[0, 15.5]" :size="290" :label="radarLabel" />
            </div>
          </section>

          <section class="panel panel-pad">
            <h2 class="t-h3 sum-h">{{ L('文件信息', 'ファイル情報') }}</h2>
            <dl class="kv">
              <dt>TITLE</dt>
              <dd lang="ja">{{ result.title }}</dd>
              <dt>SUBTITLE</dt>
              <dd lang="ja">{{ result.subtitle }}</dd>
              <dt>BPM</dt>
              <dd class="num">{{ result.bpm }}</dd>
              <dt>OFFSET</dt>
              <dd class="num">{{ result.offset }}</dd>
              <dt>WAVE</dt>
              <dd>{{ result.wave }}</dd>
              <dt>{{ L('识别到的难度', '検出したコース') }}</dt>
              <dd>
                <span class="num">{{ result.courses.length }}</span> {{ L('个', '件') }}：{{ result.courses.map((c) => L(c.zh, c.ja)).join(' / ') }}
              </dd>
            </dl>
          </section>
        </div>

        <section class="panel preview">
          <div class="panel-head">
            <h2 class="t-h2">{{ L('谱面图', '譜面画像') }}</h2>
            <div class="pv-acts">
              <div class="seg" role="group" :aria-label="L('玩家侧', 'プレイヤー側')">
                <button :aria-pressed="side === 'p1'" @click="side = 'p1'">P1</button>
                <button :aria-pressed="side === 'p2'" @click="side = 'p2'">P2</button>
              </div>
              <button class="btn btn-primary btn-sm" @click="download"><Icon name="download" :size="16" />{{ L('下载 PNG', 'PNG をダウンロード') }}</button>
            </div>
          </div>
          <div class="sheet-wrap">
            <div class="sheet-title">
              <b class="title-1l" lang="ja" :title="result.title">{{ result.title }}</b>
              <span class="num">{{ L(course.zh, course.ja) }} {{ levelText }} · BPM {{ result.bpm }} · {{ fmt(course.notes) }} notes · {{ side.toUpperCase() }}</span>
            </div>
            <ChartSheet :seed="sheetSeed" :rows="ROWS" :density="sheetDensity" :label="sheetLabel" />
          </div>
          <p class="t-caption pv-foot">
            {{ L(`预览前 ${ROWS * 4} 小节，下载的 PNG 包含全部 ${course.measures} 小节。`, `プレビューは最初の ${ROWS * 4} 小節。PNG には全 ${course.measures} 小節が含まれます。`) }}
          </p>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* ---------- 上传 ---------- */
.up {
  max-width: 760px;
  margin: 0 auto;
  padding: 20px;
}
.drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 44px 20px;
  border: 2px dashed var(--line-strong);
  border-radius: var(--r-panel);
  background: var(--surface-2);
  text-align: center;
  transition: border-color var(--dur-1), background var(--dur-1);
}
.drop:hover,
.drop.over {
  border-color: var(--ka);
  background: color-mix(in srgb, var(--ka) 7%, var(--surface));
}
.drop:focus-visible {
  border-radius: var(--r-panel);
}
.drop-icon {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  margin-bottom: 4px;
  border-radius: 50%;
  background: var(--ink);
  color: var(--bg);
}
.drop b {
  font-size: var(--fs-16);
}
.up-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin-top: 16px;
}
.enc {
  width: 200px;
}

/* ---------- 结果头部 ---------- */
.res-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.file {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.file-icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--bg-sunk);
  flex: none;
}
.file b {
  display: block;
  font-size: var(--fs-16);
  line-height: 1.3;
}
.course-row {
  margin: 14px 0 16px;
  scrollbar-width: none;
}
.course-row::-webkit-scrollbar {
  display: none;
}
.lv {
  margin-left: 6px;
  font-size: var(--fs-14);
  color: var(--ink-3);
}
.layout {
  display: grid;
  grid-template-columns: 380px minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}
.left {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
}

/* ---------- 定数 ---------- */
.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border-bottom: 1px solid var(--line);
}
.stat {
  padding: 16px 0 14px 16px;
  border-right: 1px solid var(--line);
}
.stat:last-child {
  border-right: 0;
}
.stat .k {
  white-space: nowrap;
}
.stat.main .v {
  color: var(--don-ink);
}
.radar {
  display: grid;
  place-items: center;
  padding: 8px 12px 12px;
}
.sum-h {
  margin-bottom: 12px;
}
.kv dd {
  min-width: 0;
  overflow-wrap: anywhere;
}
.kv .num {
  font-size: var(--fs-16);
}

/* ---------- 谱面图 ---------- */
.pv-acts {
  display: flex;
  align-items: center;
  gap: 8px;
}
.sheet-wrap {
  padding: 16px;
}
.sheet-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin-bottom: 10px;
  font-size: var(--fs-13);
}
.sheet-title b {
  min-width: 0;
  max-width: 100%;
  font-size: var(--fs-16);
}
.sheet-title span {
  color: var(--ink-2);
}
.pv-foot {
  padding: 0 16px 16px;
}

@media (max-width: 1099px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
  }
  /* 单栏时的顺序：定数 → 谱面图 → 文件信息 */
  .left {
    display: contents;
  }
  .preview {
    order: 2;
  }
  .left > :last-child {
    order: 3;
  }
}
@media (max-width: 767px) {
  .up {
    padding: 16px;
  }
  .pv-acts .btn {
    flex: none;
  }
  .drop {
    padding: 32px 16px;
  }
  .up-row {
    flex-direction: column;
    align-items: stretch;
  }
  .enc {
    width: auto;
  }
  .res-head .btn {
    flex: none;
  }
  .course-row {
    margin: 12px calc(var(--gutter) * -1) 14px;
    padding: 0 var(--gutter);
  }
  .stats {
    grid-template-columns: repeat(2, 1fr);
  }
  .stat:nth-child(2) {
    border-right: 0;
  }
  .stat:nth-child(-n + 2) {
    border-bottom: 1px solid var(--line);
  }
  .preview .panel-head {
    flex-wrap: wrap;
  }
  .sheet-wrap {
    padding: 12px;
  }
  .pv-foot {
    padding: 0 12px 14px;
  }
}
</style>
