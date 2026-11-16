<script setup>
import { computed, ref } from 'vue'
import Icon from '../components/Icon.vue'
import SongCell from '../components/SongCell.vue'
import Diff from '../components/Diff.vue'
import EmptyLane from '../components/EmptyLane.vue'
import { songs, fmt } from '../mock/data'
import { L } from '../store'

/* ---------- 查配置：16 oxxo 180 鬼10 ---------- */
const DIVISIONS = [4, 6, 8, 12, 16, 24, 32, 48]
const DIFF_WORDS = { 鬼: 4, 魔王: 4, oni: 4, 里: 5, 裏: 5, ura: 5, 难: 3, 難: 3, 困难: 3, hard: 3, 普通: 2, 普: 2, 简单: 1, 简: 1, 易: 1 }
const DIFF_RE = /^(鬼|魔王|oni|里|裏|ura|难|難|困难|hard|普通|普|简单|简|易)[★☆*]?(\d{1,2})?$/i

const q = ref('16 oxxo 180 鬼10')
const parsed = computed(() => {
  const out = { division: null, pattern: '', bpm: null, d: null, star: null, unknown: [] }
  for (const tk of q.value.trim().split(/\s+/).filter(Boolean)) {
    const m = tk.match(DIFF_RE)
    if (/^[ox]+$/i.test(tk)) out.pattern = (out.pattern + tk.toLowerCase()).slice(0, 32)
    else if (m) {
      out.d = DIFF_WORDS[m[1].toLowerCase()]
      out.star = m[2] ? Math.min(10, Math.max(1, Number(m[2]))) : null
    } else if (/^\d+$/.test(tk)) {
      const n = Number(tk)
      if (out.division == null && DIVISIONS.includes(n)) out.division = n
      else if (out.bpm == null && n >= 40 && n <= 400) out.bpm = n
      else out.unknown.push(tk)
    } else out.unknown.push(tk)
  }
  return out
})
const hasTokens = computed(() => !!(parsed.value.division || parsed.value.pattern || parsed.value.bpm || parsed.value.d))
const hint = computed(() => {
  const p = parsed.value
  if (!q.value.trim()) return L('用空格分开：分音、配置、BPM、难度。只有配置是必填的。', 'スペース区切りで：分音符・配置・BPM・難易度。配置だけ必須です。')
  if (p.unknown.length) return L(`没看懂「${p.unknown.join(' ')}」，先按其余条件查。配置用 o 和 x 写，例如 oxxo。`, `「${p.unknown.join(' ')}」は読み取れませんでした。配置は o と x で書きます（例：oxxo）。`)
  if (!p.pattern) return L('还缺配置：用 o 表示咚、x 表示咔，例如 oxxo。', '配置がまだありません。o がドン、x がカッです（例：oxxo）。')
  return ''
})
const matches = computed(() => {
  const p = parsed.value
  if (!p.pattern) return []
  const d = p.d ?? 4
  const pool = songs.map((s) => ({ song: s, chart: s.charts.find((c) => c.d === d) })).filter((x) => x.chart && (p.star == null || x.chart.star === p.star))
  const seed = p.pattern.length * 13 + (p.division || 16) + (p.bpm || 0)
  return pool
    .map((x) => ({ ...x, order: (x.song.id * 31 + seed * 7) % 97 }))
    .sort((a, b) => a.order - b.order)
    .slice(0, 5)
    .map((x) => ({ ...x, key: `${x.song.id}-${d}`, measure: 1 + ((x.song.id * 7 + seed) % 72), times: 1 + ((x.song.id + seed) % 6) }))
    .sort((a, b) => b.times - a.times)
})
function patternOnly() {
  q.value = [parsed.value.division, parsed.value.pattern].filter(Boolean).join(' ')
}

/* ---------- 查物量 ---------- */
const notes = ref(765)
const noteMatches = computed(() => {
  const v = Number(notes.value)
  if (notes.value === '' || !Number.isFinite(v) || v <= 0) return []
  return songs
    .flatMap((s) => s.charts.map((c) => ({ key: `${s.id}-${c.d}`, song: s, chart: c, delta: c.notes - v })))
    .sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta) || b.chart.d - a.chart.d)
    .slice(0, 6)
})

const ENTRIES = [
  { to: '/tools/rt', icon: 'target', zh: '单曲 RT 计算器', ja: '単曲 RT 計算機', dz: '输入良、可、不可，算出这一局的单曲 Rating', dj: '良・可・不可を入れると、その 1 プレイの単曲 Rating が出ます' },
  { to: '/tools/tja', icon: 'upload', zh: 'TJA 定数与谱面图', ja: 'TJA 定数・譜面画像', dz: '上传 TJA 文件，得到各难度的定数和谱面图 PNG', dj: 'TJA をアップロードして、各コースの定数と譜面画像 PNG を取得' },
  { to: '/songs/constants', icon: 'rows', zh: '定数表', ja: '定数表', dz: '全部谱面的 V2 定数、物量和五项能力值', dj: '全譜面の V2 定数・ノーツ数・5 つの能力値' },
  { to: '/songs/615', icon: 'playTri', zh: '练习播放器（在歌曲详情页打开）', ja: '練習プレーヤー（楽曲ページで開く）', dz: '变速播放、循环指定小节', dj: '速度変更と小節ループ' },
  { to: '/account/developer', icon: 'code', zh: '开发者 API', ja: '開発者 API', dz: '用 OAuth 读取成绩和成长数据，管理应用与密钥', dj: 'OAuth で成績・成長データを取得、アプリとキーの管理' },
]
</script>

<template>
  <div class="page tools">
    <div class="duo">
      <!-- 查配置 -->
      <section class="panel">
        <div class="panel-head">
          <h2 class="t-h2 th"><Icon name="layers" />{{ L('查配置', '配置検索') }}</h2>
          <span class="keys t-caption">
            <span><i class="note" />o {{ L('咚', 'ドン') }}</span>
            <span><i class="note ka" />x {{ L('咔', 'カッ') }}</span>
          </span>
        </div>
        <div class="body">
          <div class="field">
            <label for="cfg-q">{{ L('分音　配置　BPM　难度', '分音符　配置　BPM　難易度') }}</label>
            <input id="cfg-q" v-model="q" class="input q" placeholder="16 oxxo 180 鬼10" autocomplete="off" autocapitalize="off" spellcheck="false" />
          </div>
          <div v-if="hasTokens" class="tokens" aria-live="polite">
            <span v-if="parsed.division" class="chip tok"><small>{{ L('分音', '分音符') }}</small><b class="num">{{ parsed.division }}</b></span>
            <span v-if="parsed.pattern" class="chip tok pat">
              <small>{{ L('配置', '配置') }}</small>
              <span class="pat-notes" role="img" :aria-label="parsed.pattern">
                <i v-for="(ch, i) in parsed.pattern" :key="i" class="note" :class="{ ka: ch === 'x' }" />
              </span>
            </span>
            <span v-if="parsed.bpm" class="chip tok"><small>BPM</small><b class="num">{{ parsed.bpm }}</b></span>
            <span v-if="parsed.d" class="chip tok"><small>{{ L('难度', '難易度') }}</small><Diff :d="parsed.d" :star="parsed.star" short /></span>
          </div>
          <p v-if="hint" class="field-hint">{{ hint }}</p>
        </div>

        <table v-if="matches.length" class="dt res">
          <thead>
            <tr>
              <th>{{ L('歌曲', '楽曲') }}</th>
              <th>{{ L('难度', '難易度') }}</th>
              <th class="r">{{ L('首次出现', '最初の出現') }}</th>
              <th class="r">{{ L('出现次数', '出現回数') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in matches" :key="m.key">
              <td class="c-song">
                <RouterLink :to="`/songs/${m.song.id}?d=${m.chart.d}`" class="songlink"><SongCell :song="m.song" size="sm" :sub="`BPM ${m.song.bpm}`" /></RouterLink>
              </td>
              <td class="c-diff"><Diff :d="m.chart.d" :star="m.chart.star" short /></td>
              <td class="r c-measure">{{ L('第 ', '') }}<b class="num">{{ m.measure }}</b>{{ L(' 小节', ' 小節目') }}</td>
              <td class="r c-times"><b class="num">{{ m.times }}</b> {{ L('次', '回') }}</td>
            </tr>
          </tbody>
        </table>
        <EmptyLane v-else-if="parsed.pattern" compact :title="L('没有谱面同时符合这些条件', 'すべての条件に合う譜面がありません')">
          <button class="btn" @click="patternOnly">{{ L('只按配置查', '配置だけで検索') }}</button>
        </EmptyLane>
      </section>

      <!-- 查物量 -->
      <section class="panel">
        <div class="panel-head">
          <h2 class="t-h2 th"><Icon name="music" />{{ L('查物量', 'ノーツ数検索') }}</h2>
        </div>
        <div class="body">
          <div class="field">
            <label for="notes-q">{{ L('音符数', 'ノーツ数') }}</label>
            <input id="notes-q" v-model.number="notes" class="input q num" type="number" inputmode="numeric" min="1" max="2000" placeholder="765" />
          </div>
          <p v-if="!noteMatches.length" class="field-hint">{{ L('输入一个音符数，列出物量最接近的 6 张谱面。', 'ノーツ数を入力すると、近い譜面を 6 件表示します。') }}</p>
        </div>
        <ul v-if="noteMatches.length" class="nlist">
          <li v-for="m in noteMatches" :key="m.key">
            <RouterLink :to="`/songs/${m.song.id}?d=${m.chart.d}`" class="nrow">
              <SongCell :song="m.song" size="sm" class="grow" />
              <Diff :d="m.chart.d" :star="m.chart.star" short />
              <b class="num n-notes">{{ fmt(m.chart.notes) }}</b>
              <span v-if="m.delta === 0" class="tag tag-ok n-delta">{{ L('一致', '一致') }}</span>
              <span v-else class="num n-delta faint">{{ m.delta > 0 ? '+' : '−' }}{{ Math.abs(m.delta) }}</span>
            </RouterLink>
          </li>
        </ul>
      </section>
    </div>

    <section class="section">
      <div class="section-head"><h2 class="t-h2">{{ L('更多工具', 'その他のツール') }}</h2></div>
      <ul class="panel entries">
        <li v-for="e in ENTRIES" :key="e.to">
          <RouterLink :to="e.to" class="entry">
            <span class="e-icon"><Icon :name="e.icon" :size="22" /></span>
            <span class="grow">
              <b>{{ L(e.zh, e.ja) }}</b>
              <span class="t-small">{{ L(e.dz, e.dj) }}</span>
            </span>
            <Icon name="chevR" :size="18" />
          </RouterLink>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.duo {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}
.th {
  display: flex;
  align-items: center;
  gap: 10px;
}
.keys {
  display: flex;
  gap: 14px;
}
.keys span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.keys .note {
  --n: 12px;
}
.body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 20px 18px;
}
.q {
  height: 48px;
  font-size: var(--fs-18);
  font-weight: 500;
}
.q.num {
  font-size: var(--fs-22);
  font-weight: 600;
}
.tokens {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.tok {
  gap: 8px;
  height: auto;
  min-height: 32px;
  padding: 4px 12px;
  color: var(--ink);
}
.tok small {
  font-size: var(--fs-11);
  color: var(--ink-3);
}
.tok b {
  font-size: var(--fs-16);
}
.pat {
  white-space: normal;
}
.pat-notes {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.pat-notes .note {
  --n: 16px;
}

/* ---------- 查配置结果 ---------- */
.res {
  border-top: 1px solid var(--line);
}
.res th {
  position: static;
  background: transparent;
}
.res th:first-child,
.res td:first-child {
  padding-left: 20px;
}
.res th:last-child,
.res td:last-child {
  padding-right: 20px;
}
.c-song {
  width: 100%;
  max-width: 0;
}
.songlink {
  display: block;
}
.songlink:hover :deep(.t),
.nrow:hover :deep(.t) {
  color: var(--ka-ink);
}
.res td {
  white-space: nowrap;
  color: var(--ink-2);
}
.res td b {
  font-size: var(--fs-18);
  color: var(--ink);
}

/* ---------- 查物量结果 ---------- */
.nlist {
  border-top: 1px solid var(--line);
}
.nrow {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 52px 44px;
  align-items: center;
  gap: 12px;
  padding: 8px 20px;
  border-bottom: 1px solid var(--line);
}
.nlist li:last-child .nrow {
  border-bottom: 0;
}
.n-notes {
  font-size: var(--fs-18);
  text-align: right;
}
.n-delta {
  justify-self: end;
}

/* ---------- 入口 ---------- */
.entry {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--line);
  color: var(--ink-3);
  transition: background var(--dur-1);
}
.entries li:last-child .entry {
  border-bottom: 0;
  border-radius: 0 0 var(--r-panel) var(--r-panel);
}
.entries li:first-child .entry {
  border-radius: var(--r-panel) var(--r-panel) 0 0;
}
.entry:hover {
  background: var(--surface-2);
}
.e-icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--bg-sunk);
  color: var(--ink);
  flex: none;
}
.entry b {
  display: block;
  font-size: var(--fs-16);
  color: var(--ink);
}

@media (max-width: 1099px) {
  .duo {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 767px) {
  .body {
    padding: 14px 16px 16px;
  }
  .q {
    height: 52px;
  }
  /* 结果表在手机上改成两行的列表行 */
  .res thead {
    display: none;
  }
  .res tbody tr {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 4px 12px;
    padding: 10px 16px;
    border-bottom: 1px solid var(--line);
  }
  .res tbody tr:last-child {
    border-bottom: 0;
  }
  .res td,
  .res td:first-child,
  .res td:last-child {
    display: block;
    max-width: none;
    width: auto;
    padding: 0;
    border: 0;
  }
  .c-song {
    grid-column: 1;
    grid-row: 1;
    min-width: 0;
  }
  .c-diff {
    grid-column: 1;
    grid-row: 2;
    padding-left: 44px !important;
  }
  .c-measure {
    grid-column: 2;
    grid-row: 1;
  }
  .c-times {
    grid-column: 2;
    grid-row: 2;
  }
  .nrow {
    grid-template-columns: minmax(0, 1fr) auto 44px 36px;
    gap: 8px;
    padding: 10px 16px;
  }
  .entry {
    gap: 12px;
    padding: 14px 16px;
  }
}
</style>
