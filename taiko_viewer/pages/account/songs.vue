<script setup lang="ts">
import { computed, onDeactivated, ref, shallowRef, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { buildPageDescription } from "~/utils/seo";
import { resolveViewerError } from "~/utils/viewerError";
import type { SongCatalogPayload } from "~/types/content";

const { t } = useI18n();
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
  hidePageHeader: true,
  reworkElementPlus: true,
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

const scoreSongPath = (row: SongRow) => row.isCustom || !catalogSongIds.value.has(Number(row.songNo)) ? null : localePath({
  path: `/songs/${row.songNo}`,
  query: { difficulty: row.level }
});

const profileRead = useAsyncData<ProfilePayload>(
  `account-song-profile:${identity.value}`,
  async (_app, { signal }) => { const context = identity.value; return { ...await apiFetch<ProfilePayload>("/api/account/bindings", { signal, retry: 0 }), identity: context }; },
  { lazy: true, default: () => ({ bindings: [], currentBinding: null }) }
);
const { data: profileData, error: profileError, status: profileStatus, refresh: refreshProfile, clear: clearProfile } = profileRead;

const { data: songCatalogData, error: catalogError, status: catalogStatus, refresh: refreshCatalog } = useAsyncData<SongCatalogPayload>(
  "account-song-catalog",
  (_app, { signal }) => apiFetch("/api/content/songs", { signal }),
  { lazy: true, default: () => ({ songs: [] }) }
);

const loadSongs = async (_app: unknown, { signal }: { signal: AbortSignal }) => {
    const context = identity.value;
    const result = await apiFetch<SongsPayload>("/api/account/songs", {
      signal,
      retry: 0,
      query: {
        page: page.value,
        pageSize: pageSize.value,
        keyword: keyword.value,
        level: levelFilter.value || undefined
      }
    });
    return { ...result, identity: context };
};

const songsRead = useAsyncData<SongsPayload>(`account-songs:${identity.value}`, loadSongs, {
  lazy: true,
  default: () => ({ currentBinding: null as unknown as BindingSummary, total: 0, page: 1, pageSize: 25, items: [] })
});
const { data: songsData, error: songsError, status: songsStatus, refresh: refreshSongs, clear: clearSongs } = songsRead;

const profileReady = computed(() => profileData.value?.identity === identity.value);
const currentBinding = computed(() => profileReady.value ? profileData.value?.currentBinding : null);
const busy = computed(() => switchingBinding.value || ['idle', 'pending'].includes(profileStatus.value) || ['idle', 'pending'].includes(songsStatus.value));
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
  const message = error ? await resolveViewerError(error, t("rework.scoreList.failed"), t) : "";
  if (guard.current(request)) readError.value = message;
}, { immediate: true });
const retryRead = async () => {
  await Promise.all([refreshProfile(), refreshSongs()]);
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
}, async () => { if (accountUser.value) await retryRead(); }, [profileRead, songsRead]);
// Line under the binding: what editing means for this source (synced: lock against later syncs; manual: edit / delete).
const sourceHint = computed(() => currentBinding.value ? t(currentBinding.value.isManual ? "rework.scoreList.hintManual" : "rework.scoreList.hintSynced") : "");
const catalogReadError = ref("");
watch(catalogError, async (error) => {
  const message = error ? await resolveViewerError(error, t("rework.scoreList.catalogFailed"), t) : "";
  if (catalogError.value === error) catalogReadError.value = message;
}, { immediate: true });

const applyFilters = async () => {
  page.value = 1;
  keyword.value = keywordInput.value.trim();
  await refreshSongs();
};
const filtered = computed(() => Boolean(keyword.value || levelFilter.value));
// Back to every score: the reads follow from the page / keyword / difficulty watch.
const clearFilters = () => {
  keywordInput.value = "";
  keyword.value = "";
  levelFilter.value = undefined;
  page.value = 1;
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
    ElMessage.success(t("rework.scoreList.messages.switched"));
  } catch (error: any) {
    if (bindingSwitchGuard.current(request)) ElMessage.error(error?.data?.statusMessage || error?.message || t("rework.scoreList.messages.switchFailed"));
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

// The dialogs are mounted only while open (no teleported nodes are left behind), and closed when the page is left.
const editorMounted = ref(false);
const importMounted = ref(false);
watch(editorVisible, (open) => { if (open) editorMounted.value = true; });
watch(importVisible, (open) => { if (open) importMounted.value = true; });
onDeactivated(() => {
  editorVisible.value = false;
  importVisible.value = false;
  editorMounted.value = false;
  importMounted.value = false;
});

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
    ElMessage.success(value ? t("rework.scoreList.messages.lockOn") : t("rework.scoreList.messages.lockOff"));
  } catch (error: any) {
    if (!guard.current(request)) return;
    row.isLocked = !value;
    ElMessage.error(error?.data?.statusMessage || error?.message || t("rework.scoreList.messages.lockFailed"));
  } finally {
    if (guard.current(request)) lockingKey.value = "";
  }
};

const deleteScore = async (row: SongRow) => {
  if (!resultReady.value || !currentBinding.value?.isManual) return;
  const request = guard.capture();
  const taikoId = currentBinding.value.taikoId;
  try {
    await ElMessageBox.confirm(t("rework.scoreList.messages.deleteConfirm"), t("rework.scoreList.messages.delete"), { type: "warning" });
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
    ElMessage.success(t("rework.scoreList.messages.deleteSuccess"));
    await refreshSongs();
  } catch (error: any) {
    if (guard.current(request)) ElMessage.error(error?.data?.statusMessage || error?.message || t("rework.scoreList.messages.deleteFailed"));
  }
};
</script>

<template>
  <ReworkScoresList
    v-model:keyword-input="keywordInput"
    v-model:level="levelFilter"
    v-model:page="page"
    v-model:page-size="pageSize"
    :bindings="profileReady ? profileData.bindings : []"
    :current-binding="currentBinding || null"
    :profile-ready="profileReady"
    :rows="rows"
    :total="total"
    :busy="busy"
    :result-ready="resultReady"
    :read-error="readError"
    :catalog-error="catalogReadError"
    :catalog-pending="catalogStatus === 'pending'"
    :filtered="filtered"
    :locking-key="lockingKey"
    :switching="switchingBinding"
    :hint="sourceHint"
    :song-path="scoreSongPath"
    @search="applyFilters"
    @clear="clearFilters"
    @binding="changeBinding"
    @create="openCreator"
    @import="importVisible = true"
    @edit="openEditor"
    @remove="deleteScore"
    @lock="toggleLock"
    @retry="retryRead"
    @retry-catalog="refreshCatalog()"
  />

  <AccountSongEditorDialog
    v-if="currentBinding && resultReady && editorMounted"
    :key="`editor:${identity}:${currentBinding.id}`"
    v-model="editorVisible"
    :mode="editorMode"
    :initial-song="editingSong"
    :song-catalog="songCatalog"
    :is-manual="currentBinding?.isManual"
    @saved="handleEditorSaved"
    @closed="editorMounted = false"
  />
  <AccountScoreImportDialog
    v-if="currentBinding && resultReady && importMounted"
    :key="`import:${identity}:${currentBinding.id}`"
    v-model="importVisible"
    @imported="handleImported"
    @closed="importMounted = false"
  />
</template>
