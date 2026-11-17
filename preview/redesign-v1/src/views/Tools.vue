<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import Icon from '../components/Icon.vue'
import SongCell from '../components/SongCell.vue'
import Diff from '../components/Diff.vue'
import EmptyLane from '../components/EmptyLane.vue'
import { fmt } from '../mock/data'
import { L, ensureSearch } from '../store'
import { parseConfig, findConfig, findNotes } from '../search'

/* ---------- 查配置：16 oxxo 180 鬼10 ---------- */
// 解析与匹配和命令面板共用 src/search.js：从面板带着 ?q= 进来时显示同一份结果；?notes= 预填查物量。
ensureSearch()
const route = useRoute()
const q = ref('16 oxxo 180 鬼10')
const notes = ref(765)
function fromQuery() {
  if (typeof route.query.q === 'string' && route.query.q.trim()) q.value = route.query.q
  const n = Number(route.query.notes)
  if (route.query.notes != null && Number.isFinite(n) && n > 0) notes.value = n
}
fromQuery()
watch(() => [route.query.q, route.query.notes], fromQuery)
const parsed = computed(() => parseConfig(q.value))
const hasTokens = computed(() => !!(parsed.value.division || parsed.value.pattern || parsed.value.bpm || parsed.value.d))
const hint = computed(() => {
  const p = parsed.value
  if (!q.value.trim()) return L('用空格分开：分音、配置、BPM、难度。只有配置是必填的。', 'スペース区切りで：分音符・配置・BPM・難易度。配置だけ必須です。')
  if (p.unknown.length) return L(`没看懂「${p.unknown.join(' ')}」，先按其余条件查。配置用 o 和 x 写，例如 oxxo。`, `「${p.unknown.join(' ')}」は読み取れませんでした。配置は o と x で書きます（例：oxxo）。`)
  if (!p.pattern) return L('还缺配置：用 o 表示咚、x 表示咔，例如 oxxo。', '配置がまだありません。o がドン、x がカッです（例：oxxo）。')
  return ''
})
const configResult = computed(() => findConfig(parsed.value, 50))
const matches = computed(() => configResult.value.items.map((m) => ({ ...m, key: `${m.song.id}-${m.chart.d}` })))
// 没有命中时给一个建议：去掉其余条件只按配置查；已经只有配置时换成示例查询
const EXAMPLE = '16 oxxo 180 鬼10'
const simpler = computed(() => [parsed.value.division, parsed.value.pattern].filter(Boolean).join(' '))
const suggestion = computed(() => (simpler.value && simpler.value !== q.value.trim() ? simpler.value : EXAMPLE))
function trySuggestion() {
  q.value = suggestion.value
}
const cfgLink = (m) => `/songs/${m.song.id}?d=${m.chart.d}&m=${m.measure}&from=tools`
const notesLink = (m) => `/songs/${m.song.id}?d=${m.chart.d}&from=tools`

/* ---------- 查物量 ---------- */
const noteMatches = computed(() => {
  const v = Number(notes.value)
  if (notes.value === '' || !Number.isFinite(v) || v <= 0) return []
  return findNotes(v, 6).map((m) => ({ ...m, key: `${m.song.id}-${m.chart.d}` }))
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
          <caption class="sr-only">{{ L(`含配置 ${parsed.pattern} 的谱面，共 ${matches.length} 张`, `配置 ${parsed.pattern} を含む譜面（${matches.length} 件）`) }}</caption>
          <thead>
            <tr>
              <th scope="col">{{ L('歌曲', '楽曲') }}</th>
              <th scope="col">{{ L('难度', '難易度') }}</th>
              <th scope="col" class="r">{{ L('首次出现', '最初の出現') }}</th>
              <th scope="col" class="r" aria-sort="descending">{{ L('出现次数', '出現回数') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in matches" :key="m.key">
              <td class="c-song">
                <RouterLink :to="cfgLink(m)" class="songlink"><SongCell :song="m.song" size="sm" :sub="`BPM ${m.song.bpm}`" /></RouterLink>
              </td>
              <td class="c-diff"><Diff :d="m.chart.d" :star="m.chart.star" short /></td>
              <td class="r c-measure">{{ L('第 ', '') }}<b class="num">{{ m.measure }}</b>{{ L(' 小节', ' 小節目') }}</td>
              <td class="r c-times"><b class="num">{{ m.times }}</b> {{ L('次', '回') }}</td>
            </tr>
          </tbody>
        </table>
        <EmptyLane v-else-if="parsed.pattern" compact :title="L('没有找到含这个配置的谱面', 'この配置を含む譜面は見つかりませんでした')">
          <button class="btn" @click="trySuggestion">{{ L('试试', '試す：') }}<span class="num sug">{{ suggestion }}</span></button>
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
            <RouterLink :to="notesLink(m)" class="nrow">
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
  display: flex;
  align-items: center;
  min-height: var(--hit); /* D7：列表行的可点区域 ≥ 44px */
}
.songlink:hover :deep(.t),
.nrow:hover :deep(.t) {
  color: var(--link);
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
