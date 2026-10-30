<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { buildPageDescription } from "~/utils/seo";
import { resolveViewerError, viewerErrorAlertType } from "~/utils/viewerError";
import { formatScoreRank } from "~/utils/scoreRank";
import type { SongCatalogPayload } from "~/types/content";

const { t, locale } = useI18n();
const localePath = useLocalePath();
const apiFetch = useViewerApiFetch();
const accountUser = useState<{ id: number } | null>("account-user", () => null);
const bindingGeneration = useState("account-binding-generation", () => 0);
const homeGeneration = useState("account-home-generation", () => 0);
const identity = computed(() => `${accountUser.value?.id ?? "guest"}:${bindingGeneration.value}:${homeGeneration.value}`);
const guard = useAccountRequestGuard();
const bindingSwitchGuard = useAccountRequestGuard(false);
const importVisible = ref(false);
const page = ref(1);
const pageSize = ref(25);
const keywordInput = ref("");
const keyword = ref("");
const levelFilter = ref<number>();
const tableLoading = ref(false);
const lockingKey = ref("");
const switchingBinding = ref(false);
const editorVisible = ref(false);
const editorMode = ref<"edit" | "create">("edit");
const editingSong = ref<SongRow | null>(null);

definePageMeta({
  contentLayout: "wide",
  middleware: "account-auth",
  pageTitleKey: "account.songs",
  pageDescKey: "page.account.songs.desc",
  navKey: "/account/songs",
  breadcrumbs: [
    { labelKey: "account.title", to: "/account/profile" },
    { labelKey: "account.songs", to: "/account/songs" }
  ]
});

useViewerSeo(() => ({
  title: t("account.songs"),
  description: buildPageDescription(t("page.account.songs.desc")),
  path: "/account/songs"
}));

type BindingSummary = {
  id: number;
  taikoId: string;
  isCurrent: boolean;
  verifiedTitle: string | null;
  source: "wahlap" | "hiroba" | "manual";
  displayName: string;
  isManual: boolean;
  canExternalSync: boolean;
};

type SongRow = {
  songNo: number;
  level: number;
  levelLabel: string;
  title: string;
  titleJp: string;
  subtitle: string;
  category: string;
  bpm: string;
  version: string;
  artists: string;
  maxCombo: string | number;
  starLevel: string | number;
  shelfStatus: number | null;
  isCustom: boolean;
  isLocked: boolean;
  highScore: number;
  bestScoreRank: number;
  goodCnt: number;
  okCnt: number;
  ngCnt: number;
  poundCnt: number;
  stageCnt: number;
  clearCnt: number;
  fullComboCnt: number;
  dondafulComboCnt: number;
  comboCnt: number;
  updateDatetime: string;
};

type ProfilePayload = {
  identity?: string;
  bindings: BindingSummary[];
  currentBinding: BindingSummary | null;
};

type SongsPayload = {
  identity?: string;
  currentBinding: BindingSummary;
  total: number;
  page: number;
  pageSize: number;
  items: SongRow[];
};

const copy = computed(() =>
  locale.value === "ja"
    ? {
        title: "ローカル楽曲データ",
        intro: "現在連携中の ID の `userdata` 成績データを閲覧・編集します。ロックした譜面は今後の更新で上書きされません。",
        needBinding: "先にプロフィールでドンダーひろば ID を連携してください",
        goProfile: "プロフィールへ",
        currentBinding: "現在の連携",
        chooseBinding: "連携 ID を選択",
        searchPlaceholder: "曲名または ID を検索",
        filterDifficulty: "難易度で絞り込み",
        search: "検索",
        create: "記録を追加",
        importScores: "成績をインポート",
        total: "総件数",
        switched: "現在の連携 ID を切り替えました",
        switchFailed: "連携切り替えに失敗しました",
        lockOn: "この譜面をロックしました",
        lockOff: "この譜面のロックを解除しました",
        lockFailed: "ロック状態の更新に失敗しました",
        titleCol: "曲名",
        removed: "削除済み",
        custom: "手動追加",
        difficulty: "難易度",
        score: "スコア",
        judge: "判定 / 連打",
        rating: "評価",
        maxNotes: "最大ノーツ",
        updatedAt: "更新日時",
        lock: "ロック",
        actions: "操作",
        edit: "編集",
        delete: "削除",
        deleteConfirm: "この手動スコアを削除しますか？",
        deleteSuccess: "手動スコアを削除しました",
        deleteFailed: "スコアの削除に失敗しました",
        manualSource: "手動入力",
        good: "良",
        ok: "可",
        bad: "不可",
        drumroll: "連打",
        combo: "コンボ"
      }
    : {
        title: "本地歌曲数据",
        intro: "读取并编辑当前绑定 ID 的 `userdata` 成绩文件；锁定后，后续本地抓取更新不会覆盖该谱面记录。",
        needBinding: "请先在个人档案页绑定鼓众广场 ID",
        goProfile: "前往个人档案",
        currentBinding: "当前绑定",
        chooseBinding: "选择绑定 ID",
        searchPlaceholder: "搜索曲名或 ID",
        filterDifficulty: "按难度筛选",
        search: "搜索",
        create: "新增成绩",
        importScores: "导入成绩",
        total: "总记录数",
        switched: "当前绑定 ID 已切换",
        switchFailed: "切换绑定失败",
        lockOn: "该谱面已锁定",
        lockOff: "该谱面已解锁",
        lockFailed: "锁定状态更新失败",
        titleCol: "曲名",
        removed: "已下架",
        custom: "手动收录",
        difficulty: "难度",
        score: "分数",
        judge: "判定 / 连打",
        rating: "评价",
        maxNotes: "最大物量",
        updatedAt: "更新时间",
        lock: "锁定",
        actions: "操作",
        edit: "编辑",
        delete: "删除",
        deleteConfirm: "确定删除这条手动成绩吗？",
        deleteSuccess: "手动成绩已删除",
        deleteFailed: "删除成绩失败",
        manualSource: "手动录入",
        good: "良",
        ok: "可",
        bad: "不可",
        drumroll: "连打",
        combo: "连击"
      }
);
const levelOptions = computed(() =>
  [1, 2, 3, 4, 5].map((value) => ({ value, label: t(`difficulty.${value}`) }))
);
const scoreRankLabel = (value: unknown) => formatScoreRank(value, locale.value);
const scoreSongPath = (row: SongRow) => row.isCustom || !catalogSongIds.value.has(Number(row.songNo)) ? null : localePath({
  path: `/songs/${row.songNo}`,
  query: { difficulty: row.level }
});

const { data: profileData, error: profileError, status: profileStatus, refresh: refreshProfile, clear: clearProfile } = await useAsyncData<ProfilePayload>(
  `account-song-profile:${identity.value}`,
  async () => { const context = identity.value; return { ...await apiFetch<ProfilePayload>("/api/account/bindings"), identity: context }; },
  { default: () => ({ bindings: [], currentBinding: null }) }
);

const { data: songCatalogData, error: catalogError, status: catalogStatus, refresh: refreshCatalog } = await useAsyncData<SongCatalogPayload>(
  "account-song-catalog",
  () => apiFetch("/api/content/songs"),
  { default: () => ({ songs: [] }) }
);

const loadSongs = async () => {
  tableLoading.value = true;
  try {
    const context = identity.value;
    const result = await apiFetch<SongsPayload>("/api/account/songs", {
      query: {
        page: page.value,
        pageSize: pageSize.value,
        keyword: keyword.value,
        level: levelFilter.value || undefined
      }
    });
    return { ...result, identity: context };
  } finally {
    tableLoading.value = false;
  }
};

const { data: songsData, error: songsError, status: songsStatus, refresh: refreshSongs, clear: clearSongs } = await useAsyncData<SongsPayload>(`account-songs:${identity.value}`, loadSongs, {
  default: () => ({ currentBinding: null as unknown as BindingSummary, total: 0, page: 1, pageSize: 25, items: [] })
});

const profileReady = computed(() => profileData.value?.identity === identity.value);
const currentBinding = computed(() => profileReady.value ? profileData.value?.currentBinding : null);
const busy = computed(() => switchingBinding.value || profileStatus.value === "pending" || songsStatus.value === "pending");
const resultReady = computed(() => profileReady.value && songsData.value?.identity === identity.value && songsData.value.currentBinding?.id === currentBinding.value?.id && !busy.value && !profileError.value && !songsError.value);
const total = computed(() => resultReady.value ? songsData.value?.total || 0 : 0);
const rows = computed(() => resultReady.value ? songsData.value?.items || [] : []);
const songCatalog = shallowRef<SongCatalogPayload["songs"]>([]);
watch([songCatalogData, catalogStatus], () => {
  if (catalogStatus.value === "success") songCatalog.value = songCatalogData.value?.songs || [];
}, { immediate: true });
const catalogSongIds = computed(() => new Set(songCatalog.value.map(song => Number(song.id))));
const readError = ref("");
watch([profileError, songsError], async () => {
  const request = guard.capture();
  const error = profileError.value || songsError.value;
  const message = error ? await resolveViewerError(error, locale.value === "ja" ? "成績を読み込めませんでした" : "成绩读取失败", t) : "";
  if (guard.current(request)) readError.value = message;
}, { immediate: true });
const retryRead = async () => {
  const context = identity.value;
  await refreshProfile();
  if (context === identity.value && profileReady.value && !profileError.value) await refreshSongs();
};
watch(() => accountUser.value?.id, () => { switchingBinding.value = false; }, { flush: "sync" });
watch([page, pageSize, keyword, levelFilter], () => {
  if (profileReady.value && accountUser.value) void refreshSongs();
});
const refreshCurrentData = useAccountDataRefresh(identity, () => {
  guard.invalidate();
  editorVisible.value = false; importVisible.value = false; editingSong.value = null; lockingKey.value = "";
  if (!accountUser.value) switchingBinding.value = false;
  clearProfile(); clearSongs(); readError.value = "";
  page.value = 1;
}, async () => { if (accountUser.value) await retryRead(); });
if (accountUser.value && !profileError.value && !songsError.value &&
  (!profileReady.value || songsData.value?.identity !== identity.value)) refreshCurrentData();
const sourceLabel = computed(() => currentBinding.value?.isManual ? copy.value.manualSource : currentBinding.value?.source === "hiroba" ? "ドンだーひろば" : "华立 / Wahlap");
const sourceHint = computed(() => locale.value === "ja"
  ? currentBinding.value?.isManual ? "手動入力の成績。編集・削除できます。" : "同期された成績。ロックすると今後の更新で上書きされません。"
  : currentBinding.value?.isManual ? "手动录入成绩，可编辑或删除。" : "同步来源的成绩；锁定后，后续更新不会覆盖该谱面记录。");
const stateCopy = computed(() => locale.value === "ja" ? {retry:"再試行",loading:"成績を読み込み中…",empty:"条件に一致する成績がありません",details:"判定・更新日時・管理",manage:"成績の管理",catalog:"楽曲一覧を読み込めませんでした"} : {retry:"重试",loading:"正在读取成绩…",empty:"没有符合条件的成绩",details:"判定、更新时间与管理",manage:"成绩管理",catalog:"歌曲目录读取失败"});

const catalogReadError = ref("");
watch(catalogError, async (error) => {
  const message = error ? await resolveViewerError(error, stateCopy.value.catalog, t) : "";
  if (catalogError.value === error) catalogReadError.value = message;
}, { immediate: true });

const applyFilters = async () => {
  page.value = 1;
  keyword.value = keywordInput.value.trim();
  await refreshSongs();
};

const changeBinding = async (bindingId: number) => {
  if (!bindingId || busy.value || lockingKey.value || bindingId === currentBinding.value?.id) return;
  const request = bindingSwitchGuard.capture();
  switchingBinding.value = true;
  editorVisible.value = false; importVisible.value = false;
  guard.invalidate();
  try {
    await apiFetch("/api/account/bindings/current", {
      method: "POST",
      body: { bindingId }
    });
    if (!bindingSwitchGuard.current(request)) return;
    ElMessage.success(copy.value.switched);
  } catch (error: any) {
    if (bindingSwitchGuard.current(request)) ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.switchFailed);
  } finally {
    if (bindingSwitchGuard.current(request)) switchingBinding.value = false;
  }
};

const openCreator = () => {
  if (!resultReady.value) return;
  editorMode.value = "create";
  editingSong.value = null;
  editorVisible.value = true;
};

const handleImported = async () => {
  page.value = 1;
  await refreshSongs();
};

const openEditor = (row: SongRow) => {
  if (!resultReady.value) return;
  editorMode.value = "edit";
  editingSong.value = { ...row };
  editorVisible.value = true;
};

const handleEditorSaved = async () => {
  await refreshSongs();
};

const toggleLock = async (row: SongRow, value: boolean) => {
  if (!resultReady.value || lockingKey.value || currentBinding.value?.isManual) return;
  const request = guard.capture();
  const key = `${row.songNo}:${row.level}`;
  lockingKey.value = key;
  try {
    await apiFetch("/api/account/songs/lock", {
      method: "POST",
      body: {
        songNo: row.songNo,
        level: row.level,
        locked: value
      }
    });
    if (!guard.current(request)) return;
    row.isLocked = value;
    ElMessage.success(value ? copy.value.lockOn : copy.value.lockOff);
  } catch (error: any) {
    if (!guard.current(request)) return;
    row.isLocked = !value;
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.lockFailed);
  } finally {
    if (guard.current(request)) lockingKey.value = "";
  }
};

const deleteScore = async (row: SongRow) => {
  if (!resultReady.value || !currentBinding.value?.isManual) return;
  const request = guard.capture();
  const taikoId = currentBinding.value.taikoId;
  try {
    await ElMessageBox.confirm(copy.value.deleteConfirm, copy.value.delete, { type: "warning" });
  } catch {
    return;
  }
  if (!guard.current(request) || !resultReady.value) return;
  try {
    await apiFetch("/api/account/songs/delete", {
      method: "POST",
      body: {
        taikoId,
        songNo: row.songNo,
        level: row.level,
        confirmed: true
      }
    });
    if (!guard.current(request)) return;
    ElMessage.success(copy.value.deleteSuccess);
    await refreshSongs();
  } catch (error: any) {
    if (guard.current(request)) ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.deleteFailed);
  }
};
</script>

<template>
  <div class="songs-page">
    <section class="binding-context" :aria-label="copy.currentBinding">
      <div v-if="profileReady && profileData.bindings.length" class="binding-switcher">
        <label for="scores-binding">{{ copy.currentBinding }}</label>
        <el-select id="scores-binding" :model-value="currentBinding?.id" :placeholder="copy.chooseBinding" class="binding-select" :loading="switchingBinding" :disabled="busy || Boolean(lockingKey)" @change="changeBinding">
          <el-option v-for="binding in profileData.bindings" :key="binding.id" :label="binding.isManual ? `${binding.displayName}（${copy.manualSource}）` : binding.taikoId" :value="binding.id" />
        </el-select>
        <span v-if="currentBinding" class="source-label">{{ sourceLabel }}</span>
      </div>
      <p v-if="currentBinding" class="source-hint">{{ sourceHint }}</p>
    </section>
    <el-alert v-if="readError" :title="readError" :type="viewerErrorAlertType(readError)" :closable="false" show-icon>
      <el-button @click="retryRead">{{ stateCopy.retry }}</el-button>
    </el-alert>
    <el-alert v-if="catalogReadError" class="catalog-read-alert" :title="stateCopy.catalog" :type="viewerErrorAlertType(catalogReadError)" :closable="false" show-icon>
      <span>{{ catalogReadError }}</span> <el-button :loading="catalogStatus === 'pending'" @click="refreshCatalog()">{{ stateCopy.retry }}</el-button>
    </el-alert>
    <p v-if="busy" role="status" class="read-state">{{ stateCopy.loading }}</p>
    <el-empty v-else-if="profileReady && !profileData.bindings.length && !readError" :description="copy.needBinding">
      <NuxtLink :to="localePath('/account/profile')"><el-button type="primary">{{ copy.goProfile }}</el-button></NuxtLink>
    </el-empty>
    <template v-if="currentBinding">
      <section class="scores-controls">
        <el-form class="filter-row" @submit.prevent="applyFilters">
          <el-input v-model="keywordInput" :aria-label="copy.searchPlaceholder" :placeholder="copy.searchPlaceholder" clearable :disabled="busy" />
          <el-select v-model="levelFilter" clearable :aria-label="copy.filterDifficulty" :placeholder="copy.filterDifficulty" :disabled="busy" @change="applyFilters">
            <el-option v-for="option in levelOptions" :key="option.value" :value="option.value" :label="option.label" />
          </el-select>
          <el-button type="primary" native-type="submit" :disabled="busy">{{ copy.search }}</el-button>
        </el-form>
        <div class="manage-row" :aria-label="stateCopy.manage">
          <span v-if="resultReady" class="result-count">{{ copy.total }} <strong>{{ total }}</strong></span>
          <el-button :disabled="!resultReady" @click="openCreator">{{ copy.create }}</el-button>
          <el-button :disabled="!resultReady" @click="importVisible = true">{{ copy.importScores }}</el-button>
        </div>
      </section>
      <section class="scores-results" :aria-busy="busy">
        <el-table v-if="resultReady" :data="rows" :empty-text="stateCopy.empty" class="song-table">
          <el-table-column prop="title" :label="copy.titleCol" min-width="260">
            <template #default="{ row }">
              <div class="song-title-cell">
                <NuxtLink v-if="scoreSongPath(row)" :to="scoreSongPath(row)!" class="song-link">{{ locale === 'ja' ? row.titleJp || row.title : row.title }}</NuxtLink>
                <strong v-else class="custom-song-title">{{ locale === 'ja' ? row.titleJp || row.title : row.title }}</strong>
                <span>{{ row.titleJp || row.songNo }}</span>
                <div class="song-tags">
                  <el-tag v-if="row.shelfStatus === 1" size="small" type="warning" effect="light">{{ copy.removed }}</el-tag>
                  <el-tag v-if="row.isCustom" size="small" type="info" effect="light">{{ copy.custom }}</el-tag>
                  <el-tag v-if="currentBinding?.isManual" size="small" type="danger" effect="plain">{{ copy.manualSource }}</el-tag>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column :label="copy.difficulty" width="90"><template #default="{ row }">{{ t(`difficulty.${row.level}`) }}</template></el-table-column>
          <el-table-column prop="highScore" :label="copy.score" width="110" />
          <el-table-column :label="copy.judge" width="180">
            <template #default="{ row }">
              <div class="judge-cell">
                <span>{{ copy.good }} {{ row.goodCnt }} / {{ copy.ok }} {{ row.okCnt }} / {{ copy.bad }} {{ row.ngCnt }}</span>
                <span>{{ copy.drumroll }} {{ row.poundCnt }} / {{ copy.combo }} {{ row.comboCnt }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column :label="copy.rating" width="80">
            <template #default="{ row }">{{ scoreRankLabel(row.bestScoreRank) }}</template>
          </el-table-column>
          <el-table-column prop="maxCombo" :label="copy.maxNotes" width="94" />
          <el-table-column prop="updateDatetime" :label="copy.updatedAt" min-width="160" />
          <el-table-column v-if="!currentBinding?.isManual" :label="copy.lock" width="90">
            <template #default="{ row }">
              <el-switch
                :model-value="row.isLocked"
                :aria-label="`${copy.lock} ${row.title} ${row.levelLabel}`"
                :disabled="busy || Boolean(lockingKey)"
                :loading="lockingKey === `${row.songNo}:${row.level}`"
                @update:model-value="toggleLock(row, Boolean($event))"
              />
            </template>
          </el-table-column>
          <el-table-column :label="copy.actions" :width="currentBinding?.isManual ? 130 : 90" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openEditor(row)">{{ copy.edit }}</el-button>
              <el-button v-if="currentBinding?.isManual" link type="danger" @click="deleteScore(row)">{{ copy.delete }}</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div v-if="resultReady" class="mobile-scores">
          <p v-if="!rows.length" class="read-state">{{ stateCopy.empty }}</p>
          <article v-for="row in rows" :key="`${row.songNo}:${row.level}`" class="mobile-score">
            <NuxtLink v-if="scoreSongPath(row)" :to="scoreSongPath(row)!" class="song-link">{{ locale === 'ja' ? row.titleJp || row.title : row.title }}</NuxtLink>
                <strong v-else class="custom-song-title">{{ locale === 'ja' ? row.titleJp || row.title : row.title }}</strong>
            <div class="mobile-score-main"><span>{{ t(`difficulty.${row.level}`) }} · ★{{ row.starLevel }}</span><strong>{{ row.highScore }}</strong><span>{{ scoreRankLabel(row.bestScoreRank) }}</span></div>
            <div class="song-tags"><el-tag v-if="row.shelfStatus === 1" size="small" type="warning">{{ copy.removed }}</el-tag><el-tag v-if="row.isCustom" size="small" type="info">{{ copy.custom }}</el-tag><el-tag v-if="row.isLocked" size="small">{{ copy.lock }}</el-tag></div>
            <details><summary>{{ stateCopy.details }}</summary>
              <dl class="score-details">
                <div><dt>ID / {{ copy.titleCol }}</dt><dd>{{ row.songNo }} · {{ row.titleJp || row.title }}</dd></div>
                <div><dt>{{ copy.judge }}</dt><dd>{{ copy.good }} {{ row.goodCnt }} / {{ copy.ok }} {{ row.okCnt }} / {{ copy.bad }} {{ row.ngCnt }}</dd></div>
                <div><dt>{{ copy.drumroll }} / {{ copy.combo }}</dt><dd>{{ row.poundCnt }} / {{ row.comboCnt }}</dd></div>
                <div><dt>{{ copy.maxNotes }}</dt><dd>{{ row.maxCombo }}</dd></div>
                <div><dt>{{ copy.updatedAt }}</dt><dd>{{ row.updateDatetime }}</dd></div>
              </dl>
              <div class="mobile-management"><label v-if="!currentBinding.isManual">{{ copy.lock }} <el-switch :model-value="row.isLocked" :aria-label="copy.lock" :disabled="busy || Boolean(lockingKey)" :loading="lockingKey === `${row.songNo}:${row.level}`" @update:model-value="toggleLock(row, Boolean($event))" /></label>
                <el-button @click="openEditor(row)">{{ copy.edit }}</el-button><el-button v-if="currentBinding.isManual" type="danger" plain @click="deleteScore(row)">{{ copy.delete }}</el-button>
              </div>
            </details>
          </article>
        </div>
        <div v-if="resultReady" class="pagination-row">
          <el-pagination
            v-model:current-page="page"
            v-model:page-size="pageSize"
            background
            layout="total, sizes"
            :page-sizes="[25, 50, 100]"
            :total="total"
          />
          <el-pagination
            v-model:current-page="page"
            v-model:page-size="pageSize"
            background
            layout="prev, pager, next"
            :page-sizes="[25, 50, 100]"
            :pager-count="5"
            :total="total"
          />
        </div>
      </section>
    </template>
  </div>

  <AccountSongEditorDialog
    v-if="currentBinding && resultReady"
    :key="`editor:${identity}:${currentBinding.id}`"
    v-model="editorVisible"
    :mode="editorMode"
    :initial-song="editingSong"
    :song-catalog="songCatalog"
    :is-manual="currentBinding?.isManual"
    @saved="handleEditorSaved"
  />
  <AccountScoreImportDialog v-if="currentBinding && resultReady" :key="`import:${identity}:${currentBinding.id}`" v-model="importVisible" @imported="handleImported" />
</template>

<style scoped>
.songs-page { display:grid; gap:20px; min-width:0; }
.binding-context { display:grid; gap:8px; }
.binding-switcher { display:flex; align-items:center; flex-wrap:wrap; gap:12px; }
.binding-switcher label, .source-label, .source-hint, .read-state, .result-count { color:var(--viewer-text-muted); font-size:14px; }
.binding-select { width:260px; max-width:100%; }
.source-hint { margin:0; line-height:1.6; }
.scores-controls { display:grid; gap:12px; padding-block:16px; border-block:1px solid var(--viewer-border); }
.filter-row { display:grid; grid-template-columns:minmax(220px,1fr) 170px auto; gap:12px; max-width:800px; }
.manage-row { display:flex; align-items:center; flex-wrap:wrap; gap:10px; }
.manage-row :deep(.el-button + .el-button) { margin-left:0; }
.result-count { margin-right:auto; }
.result-count strong { color:var(--viewer-text); font-variant-numeric:tabular-nums; }
.scores-results { min-width:0; }
.song-title-cell { display:grid; gap:4px; }
.song-link { color:var(--viewer-link); font-weight:650; text-decoration:none; overflow-wrap:anywhere; line-height:1.5; }
.custom-song-title { color:var(--viewer-text); overflow-wrap:anywhere; line-height:1.5; }
.song-link:hover { text-decoration:underline; }
.song-title-cell > span, .judge-cell { color:var(--viewer-text-muted); font-size:13px; }
.song-tags { display:flex; flex-wrap:wrap; gap:6px; }
.song-tags:empty { display:none; }
.judge-cell { display:grid; gap:4px; line-height:1.5; }
.pagination-row { margin-top:16px; display:flex; flex-wrap:wrap; align-items:center; justify-content:flex-end; gap:12px 20px; }
.pagination-row :deep(.el-pagination) { flex-wrap:nowrap; gap:8px; }
.mobile-scores { display:none; }
@media(max-width:640px) {
 .binding-switcher { align-items:flex-start; }
 .binding-switcher label { width:100%; }
 .binding-select { flex:1; min-width:200px; }
 .filter-row { grid-template-columns:minmax(0,1fr) auto; }
 .filter-row > :first-child { grid-column:1/-1; }
 .song-table { display:none; }
 .mobile-scores { display:block; }
 .mobile-score { padding-block:14px; border-bottom:1px solid var(--viewer-border); display:grid; gap:8px; }
 .mobile-score:first-child { padding-top:0; }
 .mobile-score-main { display:flex; flex-wrap:wrap; align-items:baseline; gap:12px; font-size:14px; }
 .mobile-score-main strong { margin-left:auto; font-size:19px; font-variant-numeric:tabular-nums; }
 .mobile-score details { font-size:14px; }
 .mobile-score summary { color:var(--viewer-link); padding-block:10px; cursor:pointer; min-height:44px; box-sizing:border-box; }
 .score-details { display:grid; gap:8px; margin:4px 0 12px; }
 .score-details div { display:grid; grid-template-columns:100px minmax(0,1fr); gap:8px; }
 .score-details dt { color:var(--viewer-text-muted); }
 .score-details dd { margin:0; overflow-wrap:anywhere; }
 .mobile-management { display:flex; align-items:center; flex-wrap:wrap; gap:12px; }
 .mobile-management label { display:flex; align-items:center; gap:8px; }
 .mobile-management :deep(.el-button + .el-button) { margin-left:0; }
 .pagination-row { justify-content:center; }
 .pagination-row :deep(.el-pagination) { justify-content:center; max-width:100%; }
}
</style>
