<script setup lang="ts">
import { computed, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { buildPageDescription } from "~/utils/seo";
import type { SongCatalogPayload } from "~/types/content";

const { t, locale } = useI18n();
const localePath = useLocalePath();
const apiFetch = useViewerApiFetch();
const page = ref(1);
const pageSize = ref(25);
const keywordInput = ref("");
const keyword = ref("");
const levelFilter = ref(0);
const tableLoading = ref(false);
const lockingKey = ref("");
const switchingBinding = ref(false);
const editorVisible = ref(false);
const editorMode = ref<"edit" | "create">("edit");
const editingSong = ref<SongRow | null>(null);

definePageMeta({
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
  bindings: BindingSummary[];
  currentBinding: BindingSummary | null;
};

type SongsPayload = {
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

const { data: profileData, refresh: refreshProfile } = await useAsyncData<ProfilePayload>(
  "account-song-profile",
  () => apiFetch("/api/account/bindings"),
  { default: () => ({ bindings: [], currentBinding: null }) }
);

const { data: songCatalogData } = await useAsyncData<SongCatalogPayload>(
  "account-song-catalog",
  () => apiFetch("/api/content/songs"),
  { default: () => ({ songs: [] }) }
);

const loadSongs = async () => {
  tableLoading.value = true;
  try {
    return await apiFetch<SongsPayload>("/api/account/songs", {
      query: {
        page: page.value,
        pageSize: pageSize.value,
        keyword: keyword.value,
        level: levelFilter.value || undefined
      }
    });
  } finally {
    tableLoading.value = false;
  }
};

const { data: songsData, refresh: refreshSongs } = await useAsyncData<SongsPayload>("account-songs", loadSongs, {
  default: () => ({ currentBinding: null as unknown as BindingSummary, total: 0, page: 1, pageSize: 25, items: [] }),
  watch: [page, pageSize, keyword, levelFilter]
});

const total = computed(() => songsData.value?.total || 0);
const rows = computed(() => songsData.value?.items || []);
const currentBinding = computed(() => songsData.value?.currentBinding || profileData.value?.currentBinding || null);
const songCatalog = computed(() => songCatalogData.value?.songs || []);

const applyFilters = async () => {
  page.value = 1;
  keyword.value = keywordInput.value.trim();
  await refreshSongs();
};

const changeBinding = async (bindingId: number) => {
  if (!bindingId || switchingBinding.value) return;
  switchingBinding.value = true;
  try {
    await apiFetch("/api/account/bindings/current", {
      method: "POST",
      body: { bindingId }
    });
    ElMessage.success(copy.value.switched);
    page.value = 1;
    await Promise.all([refreshProfile(), refreshSongs()]);
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.switchFailed);
  } finally {
    switchingBinding.value = false;
  }
};

const openCreator = () => {
  editorMode.value = "create";
  editingSong.value = null;
  editorVisible.value = true;
};

const openEditor = (row: SongRow) => {
  editorMode.value = "edit";
  editingSong.value = { ...row };
  editorVisible.value = true;
};

const handleEditorSaved = async () => {
  await refreshSongs();
};

const toggleLock = async (row: SongRow, value: boolean) => {
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
    row.isLocked = value;
    ElMessage.success(value ? copy.value.lockOn : copy.value.lockOff);
  } catch (error: any) {
    row.isLocked = !value;
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.lockFailed);
  } finally {
    lockingKey.value = "";
  }
};

const deleteScore = async (row: SongRow) => {
  try {
    await ElMessageBox.confirm(copy.value.deleteConfirm, copy.value.delete, { type: "warning" });
  } catch {
    return;
  }
  try {
    await apiFetch("/api/account/songs/delete", {
      method: "POST",
      body: {
        taikoId: currentBinding.value?.taikoId,
        songNo: row.songNo,
        level: row.level,
        confirmed: true
      }
    });
    ElMessage.success(copy.value.deleteSuccess);
    await refreshSongs();
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.deleteFailed);
  }
};
</script>

<template>
  <div class="songs-page">
    <el-card class="panel-card control-card">
      <div class="section-title">
        <h3>{{ copy.title }}</h3>
        <p>{{ copy.intro }}</p>
      </div>
      <div v-if="!profileData.bindings.length" class="empty-wrap">
        <el-empty :description="copy.needBinding">
          <template #extra>
            <NuxtLink :to="localePath('/account/profile')">
              <el-button type="primary">{{ copy.goProfile }}</el-button>
            </NuxtLink>
          </template>
        </el-empty>
      </div>
      <template v-else>
        <div class="toolbar-row">
          <div class="toolbar-left">
            <div class="binding-switcher">
              <span>{{ copy.currentBinding }}</span>
              <el-select
                :model-value="currentBinding?.id"
                :placeholder="copy.chooseBinding"
                class="binding-select"
                :loading="switchingBinding"
                @change="changeBinding"
              >
                <el-option
                  v-for="binding in profileData.bindings"
                  :key="binding.id"
                  :label="binding.isManual ? `${binding.displayName}（${copy.manualSource}）` : binding.taikoId"
                  :value="binding.id"
                />
              </el-select>
            </div>
            <div class="filter-row">
              <el-input v-model="keywordInput" :placeholder="copy.searchPlaceholder" clearable @keyup.enter="applyFilters" />
              <el-select v-model="levelFilter" clearable :placeholder="copy.filterDifficulty" @change="applyFilters">
                <el-option v-for="option in levelOptions" :key="option.value" :value="option.value" :label="option.label" />
              </el-select>
              <el-button type="primary" @click="applyFilters">{{ copy.search }}</el-button>
              <el-button type="success" plain @click="openCreator">{{ copy.create }}</el-button>
            </div>
          </div>
          <div class="toolbar-meta">
            <span>{{ copy.total }}</span>
            <strong>{{ total }}</strong>
          </div>
        </div>

        <el-table v-loading="tableLoading" :data="rows" class="song-table">
          <el-table-column prop="title" :label="copy.titleCol" min-width="260">
            <template #default="{ row }">
              <div class="song-title-cell">
                <strong>{{ row.title }}</strong>
                <span>{{ row.titleJp || row.songNo }}</span>
                <div class="song-tags">
                  <el-tag v-if="row.shelfStatus === 1" size="small" type="warning" effect="light">{{ copy.removed }}</el-tag>
                  <el-tag v-if="row.isCustom" size="small" type="info" effect="light">{{ copy.custom }}</el-tag>
                  <el-tag v-if="currentBinding?.isManual" size="small" type="danger" effect="plain">{{ copy.manualSource }}</el-tag>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="levelLabel" :label="copy.difficulty" width="90" />
          <el-table-column prop="highScore" :label="copy.score" width="110" />
          <el-table-column :label="copy.judge" width="180">
            <template #default="{ row }">
              <div class="judge-cell">
                <span>{{ copy.good }} {{ row.goodCnt }} / {{ copy.ok }} {{ row.okCnt }} / {{ copy.bad }} {{ row.ngCnt }}</span>
                <span>{{ copy.drumroll }} {{ row.poundCnt }} / {{ copy.combo }} {{ row.comboCnt }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="bestScoreRank" :label="copy.rating" width="80" />
          <el-table-column prop="maxCombo" :label="copy.maxNotes" width="94" />
          <el-table-column prop="updateDatetime" :label="copy.updatedAt" min-width="160" />
          <el-table-column v-if="!currentBinding?.isManual" :label="copy.lock" width="90">
            <template #default="{ row }">
              <el-switch
                :model-value="row.isLocked"
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

        <div class="pagination-row">
          <el-pagination
            v-model:current-page="page"
            v-model:page-size="pageSize"
            background
            layout="total, sizes, prev, pager, next"
            :page-sizes="[25, 50, 100]"
            :total="total"
          />
        </div>
      </template>
    </el-card>
  </div>

  <AccountSongEditorDialog
    v-model="editorVisible"
    :mode="editorMode"
    :initial-song="editingSong"
    :song-catalog="songCatalog"
    :is-manual="currentBinding?.isManual"
    @saved="handleEditorSaved"
  />
</template>

<style scoped>
.songs-page {
  display: grid;
}

.section-title h3 {
  margin: 0;
  font-size: 24px;
}

.section-title p {
  margin: 8px 0 18px;
  color: #7d6a5a;
  line-height: 1.7;
}

.toolbar-row {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 18px;
}

.toolbar-left {
  display: grid;
  gap: 12px;
  flex: 1;
}

.binding-switcher {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.binding-switcher span,
.toolbar-meta span {
  color: #7d6a5a;
  font-size: 13px;
}

.binding-select {
  width: 220px;
}

.filter-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 140px auto auto;
  gap: 12px;
}

.toolbar-meta {
  min-width: 120px;
  padding: 12px 16px;
  border-radius: 14px;
  background: rgba(255, 248, 240, 0.86);
  display: grid;
  gap: 4px;
  align-self: flex-start;
}

.toolbar-meta strong {
  font-size: 24px;
}

.song-title-cell {
  display: grid;
  gap: 4px;
}

.song-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.song-title-cell span {
  color: #7d6a5a;
  font-size: 13px;
}

.judge-cell {
  display: grid;
  gap: 4px;
  color: #7d6a5a;
  font-size: 13px;
  line-height: 1.5;
}

.pagination-row {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.empty-wrap {
  padding: 18px 0 6px;
}

@media (max-width: 860px) {
  .toolbar-row {
    flex-direction: column;
  }

  .filter-row {
    grid-template-columns: 1fr;
  }

  .binding-switcher {
    flex-direction: column;
    align-items: flex-start;
  }

  .binding-select {
    width: 100%;
  }
}
</style>
