<script setup lang="ts">
import type { SongCatalogItem, SongCatalogPagePayload } from '~/types/content';
import type { AutoJudgment, Judgments, RtCalculatorPayload } from '~/utils/rtCalculator';
import { calculateV1, calculateV2, resolveJudgments } from '~/utils/rtCalculator';

definePageMeta({ pageTitleKey: 'tools.rtCalculator', hidePageDescription: true, navKey: '/tools/rt-calculator', hidePageHeader: true, reworkElementPlus: true,
  breadcrumbs: [{ labelKey: 'nav.more', to: '/more' }, { labelKey: 'tools.rtCalculator', to: '/tools/rt-calculator' }] });
const { locale, t } = useI18n();
const route = useRoute(), router = useRouter(), localePath = useLocalePath(), apiFetch = useViewerApiFetch();
// Copy in locales/{zh,ja}.json rework.toolPages.rt (moved word for word in slice F; same keys and shape as before).
const RT_COPY_KEYS = ['song', 'search', 'difficulty', 'version', 'notes', 'good', 'ok', 'bad', 'auto', 'manual', 'full', 'accuracy', 'rating', 'result',
  'choose', 'empty', 'invalid', 'below', 'failed', 'retry', 'searchFailed', 'noSongs', 'loading', 'source', 'detail', 'v2Failed'] as const;
const copy = computed(() => ({
  ...Object.fromEntries(RT_COPY_KEYS.map(key => [key, t(`rework.toolPages.rt.${key}`)])) as Record<(typeof RT_COPY_KEYS)[number], string>,
  v1: [0, 1, 2, 3, 4, 5].map(i => t(`rework.toolPages.rt.v1.${i}`)),
  v2: [0, 1, 2, 3, 4, 5].map(i => t(`rework.toolPages.rt.v2.${i}`))
}));
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
  <div class="rw-stack">
    <ReworkPageHeader :title="t('tools.rtCalculator')" />
    <ReworkToolsRtCalculator
      v-model:version="version"
      v-model:level="level"
      :copy="copy"
      :song-id="songId"
      :options="options"
      :searching="searching"
      :search-error="searchError"
      :pending="pending"
      :failed="Boolean(error)"
      :has-song="Boolean(songData)"
      :has-chart="Boolean(chart)"
      :v2-unavailable="Boolean(songData?.v2Unavailable)"
      :total-notes="totalNotes"
      :auto="auto"
      :resolved="resolved"
      :result="result"
      :full-result="fullResult"
      :input-value="inputValue"
      @search="searchSongs"
      @select="selectSong"
      @retry="refresh()"
      @input="inputCount"
      @auto="changeAuto"
      @full="fullCombo"
    />
  </div>
</template>
