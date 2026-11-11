<script setup lang="ts">
import type { SongCatalogItem, SongCatalogPagePayload } from '~/types/content';
import type { AutoJudgment, Judgments, RtCalculatorPayload } from '~/utils/rtCalculator';
import { calculateV1, calculateV2, resolveJudgments } from '~/utils/rtCalculator';

definePageMeta({ pageTitleKey: 'tools.rtCalculator', hidePageDescription: true, navKey: '/tools/rt-calculator',
  breadcrumbs: [{ labelKey: 'nav.more', to: '/more' }, { labelKey: 'tools.rtCalculator', to: '/tools/rt-calculator' }] });
const { locale, t } = useI18n();
const route = useRoute(), router = useRouter(), localePath = useLocalePath(), apiFetch = useViewerApiFetch();
const copy = computed(() => locale.value === 'ja' ? {
  song: '楽曲', search: '曲名・IDで検索', difficulty: '難易度', version: '計算方式', notes: 'ノーツ数',
  good: '良', ok: '可', bad: '不可', auto: '自動補完', manual: '手動入力', full: '全良',
  accuracy: '精度', rating: '総合 RT', result: '計算結果', choose: '楽曲を選択してください', empty: 'この難易度の定数はありません',
  invalid: '判定数は0以上の整数で、合計をノーツ数に合わせてください。', below: '精度が75%未満のため、Ratingの対象外です。',
  failed: '楽曲データを読み込めませんでした。', retry: '再試行', searchFailed: '検索に失敗しました。入力し直してください。', noSongs: '該当する楽曲はありません',
  loading: '読み込み中…', source: 'V2 定数の出典', detail: '楽曲詳細', v1: ['大歌力', '体力', '高速処理', '精度力', 'リズム処理', '複合処理'],
  v2: ['体力', '手速', '瞬発力', '精度', 'リズム', '複合'], v2Failed: 'V2 定数を読み込めませんでした。'
} : {
  song: '歌曲', search: '搜索曲名或 ID', difficulty: '难度', version: '计算版本', notes: '音符数',
  good: '良', ok: '可', bad: '不可', auto: '自动补齐', manual: '手动输入', full: '全良',
  accuracy: '精度', rating: '综合 RT', result: '计算结果', choose: '请选择歌曲', empty: '暂无该难度的定数',
  invalid: '判定数须为非负整数，且合计等于谱面音符数。', below: '精度低于 75%，不计入 Rating。',
  failed: '歌曲数据加载失败。', retry: '重试', searchFailed: '搜索失败，请重新输入。', noSongs: '没有找到歌曲',
  loading: '加载中…', source: 'V2 定数来源', detail: '歌曲详情', v1: ['大歌力', '体力', '高速处理', '精度力', '节奏处理', '复合处理'],
  v2: ['体力', '手速', '爆发', '精度', '节奏', '复合'], v2Failed: 'V2 定数加载失败。'
});
useViewerSeo(() => ({ title: t('tools.rtCalculator'), description: t('tools.rtCalculator'), path: '/tools/rt-calculator' }));

const songId = computed(() => /^\d{1,9}$/.test(String(route.query.songId || '')) ? Number(route.query.songId) : 0);
const version = ref<'v1' | 'v2'>('v2');
const level = ref([3, 4, 5].includes(Number(route.query.level)) ? Number(route.query.level) : 4);
const counts = reactive<Judgments>({ good: 0, ok: 0, bad: 0 });
const auto = ref<AutoJudgment>('good');
const judgmentKeys = ['good', 'ok', 'bad'] as const;
const { data, pending, error, refresh } = await useAsyncData('rt-calculator-song',
  () => songId.value ? apiFetch<RtCalculatorPayload>('/api/tools/rt-calculator', { query: { songId: songId.value }, timeout: 15_000, retry: 0 }) : Promise.resolve(null),
  { watch: [songId], default: () => null });
// Reject the previous song's payload while a new route is loading.
const songData = computed(() => data.value?.song.id === songId.value ? data.value : null);
const v1Chart = computed(() => songData.value?.v1.find(row => row.level === level.value));
const difficultyKeys: Record<number, string> = { 3: 'hard', 4: 'oni', 5: 'edit' };
const v2Chart = computed(() => songData.value?.v2.find(row => row.difficulty === difficultyKeys[level.value]));
const chart = computed(() => version.value === 'v1' ? v1Chart.value : v2Chart.value);
const totalNotes = computed(() => chart.value?.totalNotes || 0);
const resolved = computed(() => resolveJudgments(totalNotes.value, counts, auto.value));
const result = computed(() => {
  if (pending.value || error.value || !resolved.value || !chart.value) return null;
  return version.value === 'v1' ? calculateV1(v1Chart.value!, resolved.value) : calculateV2(v2Chart.value!, resolved.value);
});
const fullResult = computed(() => {
  if (!chart.value) return null;
  const full = { good: totalNotes.value, ok: 0, bad: 0 };
  return version.value === 'v1' ? calculateV1(v1Chart.value!, full) : calculateV2(v2Chart.value!, full);
});
function fullCombo() { counts.good = totalNotes.value; counts.ok = 0; counts.bad = 0; }
watch(songId, () => { counts.good = 0; counts.ok = 0; counts.bad = 0; });
watch(version, () => { if (version.value === 'v1' && level.value === 3) level.value = 4; });
watch(level, () => { if (songId.value) void router.replace({ query: { ...route.query, level: String(level.value) } }); });
watch(() => [version.value, level.value, totalNotes.value], () => {
  if (auto.value === 'manual') fullCombo();
});
const inputValue = (key: keyof Judgments) => key === auto.value ? (resolved.value?.[key] ?? '') : counts[key];
function inputCount(key: keyof Judgments, event: Event) {
  const target = event.target as HTMLInputElement;
  counts[key] = target.value.trim() === '' ? NaN : Number(target.value);
}
function changeAuto(event: Event) {
  if (resolved.value) Object.assign(counts, resolved.value);
  auto.value = (event.target as HTMLSelectElement).value as AutoJudgment;
}

const suggestions = ref<SongCatalogItem[]>([]), searching = ref(false), searchError = ref(false);
let searchTimer: ReturnType<typeof setTimeout> | undefined, searchController: AbortController | undefined;
let searchGeneration = 0;
const title = (song: SongCatalogItem) => locale.value === 'ja' ? song.song_name_jp || song.song_name : song.song_name;
const options = computed(() => {
  const rows = suggestions.value.map(song => ({ id: Number(song.id), label: `${title(song)} · #${song.id}` }));
  if (songData.value && !rows.some(row => row.id === songId.value)) rows.unshift({ id: songId.value,
    label: `${locale.value === 'ja' ? songData.value.song.titleJa : songData.value.song.title} · #${songId.value}` });
  return rows;
});
function searchSongs(keyword = '') {
  clearTimeout(searchTimer); searchController?.abort();
  const generation = ++searchGeneration;
  searching.value = true; searchError.value = false;
  searchTimer = setTimeout(async () => {
    const controller = new AbortController(); searchController = controller;
    try {
      const response = await apiFetch<SongCatalogPagePayload>('/api/content/songs', {
        query: { keyword, page: 1, pageSize: 24 }, signal: controller.signal, timeout: 10_000, retry: 0
      });
      if (generation === searchGeneration) suggestions.value = response.songs;
    } catch {
      if (generation === searchGeneration) { suggestions.value = []; searchError.value = true; }
    } finally { if (generation === searchGeneration) searching.value = false; }
  }, 250);
}
function selectSong(value: number) { void router.replace({ query: { ...route.query, songId: String(value), level: String(level.value) } }); }
onBeforeUnmount(() => { searchGeneration++; clearTimeout(searchTimer); searchController?.abort(); });
</script>

<template>
  <div class="rt-calculator">
    <section class="rt-controls">
      <label class="field-label" for="rt-song">{{ copy.song }}</label>
      <el-select id="rt-song" :model-value="songId || undefined" filterable remote :remote-method="searchSongs" :loading="searching"
        :placeholder="copy.search" :no-data-text="searchError ? copy.searchFailed : copy.noSongs" class="song-select"
        @visible-change="open => { if (open) searchSongs(); }" @update:model-value="selectSong">
        <el-option v-for="option in options" :key="option.id" :label="option.label" :value="option.id" />
      </el-select>
      <p v-if="searchError" class="error" role="alert">{{ copy.searchFailed }}</p>
      <div class="selection-row">
        <label>{{ copy.version }}<select v-model="version"><option value="v2">V2</option><option value="v1">V1</option></select></label>
        <label>{{ copy.difficulty }}<select v-model.number="level">
          <option v-for="difficulty in (version === 'v1' ? [4, 5] : [3, 4, 5])" :key="difficulty" :value="difficulty">{{ t(`difficulty.${difficulty}`) }}</option>
        </select></label>
      </div>
      <p v-if="pending" role="status">{{ copy.loading }}</p>
      <div v-else-if="error" role="alert"><p class="error">{{ copy.failed }}</p><button @click="refresh()">{{ copy.retry }}</button></div>
      <template v-else-if="songData">
        <div class="chart-heading">
          <NuxtLink :to="localePath(`/songs/${songId}`)">{{ copy.detail }} ↗</NuxtLink>
          <span v-if="chart">{{ copy.notes }} <strong>{{ totalNotes }}</strong></span>
        </div>
        <template v-if="chart">
          <div class="judgment-toolbar"><label>{{ copy.auto }}<select :value="auto" @change="changeAuto">
            <option v-for="key in judgmentKeys" :key="key" :value="key">{{ copy[key] }}</option>
            <option value="manual">{{ copy.manual }}</option>
          </select></label><button type="button" @click="fullCombo">{{ copy.full }}</button></div>
          <div class="judgment-grid">
            <label v-for="key in judgmentKeys" :key="key" :class="['judgment', key]" :for="`rt-${key}`">
              <span>{{ copy[key] }}</span><input :id="`rt-${key}`" type="number" inputmode="numeric" min="0" :max="totalNotes" step="1"
                :value="inputValue(key)" :readonly="auto === key" :aria-invalid="!resolved" :aria-describedby="!resolved ? 'rt-validation' : undefined" @input="inputCount(key, $event)" />
            </label>
          </div>
          <p v-if="!resolved" id="rt-validation" class="error" role="alert">{{ copy.invalid }}</p>
          <p v-else-if="result && !result.eligible" class="notice" role="status">{{ copy.below }}</p>
        </template>
        <div v-else class="empty" role="status">
          <p>{{ version === 'v2' && songData.v2Unavailable ? copy.v2Failed : copy.empty }}</p>
          <button type="button" @click="refresh()">{{ copy.retry }}</button>
        </div>
      </template>
      <p v-else class="empty">{{ copy.choose }}</p>
    </section>

    <section class="rt-output" :aria-label="copy.result" :aria-busy="pending">
      <div class="result-summary" role="status" aria-live="polite" aria-atomic="true">
        <div class="rating"><span>{{ copy.rating }} · {{ version.toUpperCase() }}</span>
          <strong>{{ !pending && result?.eligible ? result.rating.toFixed(4) : '—' }}</strong></div>
        <div class="accuracy"><span>{{ copy.accuracy }}</span><strong>{{ !pending && result ? `${(result.accuracy * 100).toFixed(4)}%` : '—' }}</strong></div>
      </div>
      <dl class="dimensions">
        <div v-for="(name, index) in copy[version]" :key="`${version}-${name}`" class="dimension">
          <dt>{{ name }}</dt><dd>{{ !pending && result?.eligible ? result.dimensions[index].toFixed(4) : '—' }}</dd>
          <span class="dimension-track" aria-hidden="true"><span :style="{ width: `${!pending && result?.eligible && fullResult?.dimensions[index] ? Math.min(100, result.dimensions[index] / fullResult.dimensions[index] * 100) : 0}%` }" /></span>
        </div>
      </dl>
      <a v-if="version === 'v2'" class="source" href="https://github.com/OurTaiko/Constants" target="_blank" rel="noopener noreferrer">{{ copy.source }} · OurTaiko / Constants ↗</a>
    </section>
  </div>
</template>

<style scoped>
.rt-calculator { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 24px; max-width: 1000px; color: var(--viewer-text); }
.rt-controls, .rt-output { min-width: 0; padding: clamp(20px, 3vw, 32px); border: 1px solid var(--viewer-border); border-radius: var(--viewer-radius); background: var(--viewer-surface); }
.field-label, .selection-row label, .judgment-toolbar label { display: grid; gap: 8px; font-size: 14px; font-weight: 600; }
.song-select { width: 100%; margin-top: 8px; }
.song-select :deep(.el-select__wrapper) { min-height: 44px; }
.selection-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 24px; }
select, button, input { font: inherit; color: inherit; }
select, button { min-height: 44px; border: 1px solid var(--viewer-control-border); border-radius: 8px; background: var(--viewer-surface); padding: 8px 12px; }
button, select { cursor: pointer; }
button:hover { background: var(--viewer-surface-hover); }
button:focus-visible, select:focus-visible, input:focus-visible { outline: 2px solid var(--viewer-link); outline-offset: 3px; }
.chart-heading { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; padding: 20px 0; margin-top: 4px; border-bottom: 1px solid var(--viewer-border); font-size: 14px; }
a { color: var(--viewer-link); }
.chart-heading strong { margin-left: 6px; font-variant-numeric: tabular-nums; }
.judgment-toolbar { display: flex; align-items: end; justify-content: space-between; gap: 12px; margin: 24px 0 16px; }
.judgment-toolbar label { grid-template-columns: auto auto; align-items: center; }
.judgment-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.judgment { display: grid; gap: 10px; border-top: 3px solid var(--viewer-text-muted); padding-top: 12px; font-size: 14px; font-weight: 600; }
.judgment.good { border-color: var(--viewer-primary); }
.judgment.ok { border-color: var(--viewer-link); }
.judgment input { width: 100%; min-width: 0; box-sizing: border-box; min-height: 48px; padding: 8px; border: 1px solid var(--viewer-control-border); border-radius: 8px; background: var(--viewer-surface); font-size: 20px; font-variant-numeric: tabular-nums; }
.judgment input[readonly] { background: var(--viewer-surface-subtle); border-style: dashed; }
.error { color: var(--viewer-error); font-size: 14px; line-height: 1.6; }
.notice, .empty { color: var(--viewer-text-muted); font-size: 14px; line-height: 1.6; margin-top: 24px; }
.rt-output { background: var(--viewer-surface-subtle); }
.result-summary { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: 20px; padding-bottom: 24px; border-bottom: 1px solid var(--viewer-border); }
.rating, .accuracy { display: grid; gap: 10px; }
.result-summary span { font-size: 14px; color: var(--viewer-text-muted); }
.rating strong { color: var(--viewer-primary); font-size: clamp(32px, 4vw, 44px); line-height: 1; letter-spacing: -0.04em; }
.accuracy strong { font-size: 20px; line-height: 1.2; }
strong, dd { font-variant-numeric: tabular-nums; }
.dimensions { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 28px 0; }
.dimension { display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: baseline; }
.dimension dt { font-size: 14px; color: var(--viewer-text-muted); }
.dimension dd { margin: 0; font-size: 20px; font-weight: 600; }
.dimension-track { grid-column: 1 / -1; height: 4px; background: var(--viewer-border); overflow: hidden; border-radius: 4px; }
.dimension-track > span { display: block; height: 100%; background: var(--viewer-link); }
.source { display: inline-block; font-size: 12px; line-height: 1.6; }
@media (max-width: 900px) { .rt-calculator { grid-template-columns: 1fr; } }
@media (max-width: 420px) { .dimensions { column-gap: 16px; } .dimension { grid-template-columns: 1fr; gap: 6px; } .dimension-track { grid-column: 1; } .judgment-toolbar { flex-wrap: wrap; } }
</style>
