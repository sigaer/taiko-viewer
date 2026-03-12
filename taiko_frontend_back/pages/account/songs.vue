<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { ElMessage } from "element-plus";

const headers = import.meta.server ? useRequestHeaders(["cookie"]) : undefined;
const page = ref(1);
const pageSize = ref(25);
const keywordInput = ref("");
const keyword = ref("");
const levelFilter = ref(0);
const tableLoading = ref(false);
const lockingKey = ref("");
const switchingBinding = ref(false);
const dialogVisible = ref(false);
const saving = ref(false);
const editForm = reactive({
  songNo: 0,
  level: 0,
  title: "",
  high_score: 0,
  best_score_rank: 0,
  good_cnt: 0,
  ok_cnt: 0,
  ng_cnt: 0,
  stage_cnt: 0,
  clear_cnt: 0,
  full_combo_cnt: 0,
  dondaful_combo_cnt: 0,
  combo_cnt: 0
});

const pageMeta = {
  title: "歌曲数据",
  desc: "直接查看并维护当前绑定 ID 的本地歌曲成绩数据。"
};

definePageMeta({
  middleware: "account-auth",
  pageTitle: pageMeta.title,
  pageDesc: pageMeta.desc,
  navKey: "/account/songs",
  breadcrumbs: [
    { label: "账号系统", to: "/account/profile" },
    { label: "歌曲数据", to: "/account/songs" }
  ]
});

useSeoMeta({
  title: pageMeta.title,
  description: pageMeta.desc,
  ogTitle: pageMeta.title,
  ogDescription: pageMeta.desc
});

type BindingSummary = {
  id: number;
  taikoId: string;
  isCurrent: boolean;
  verifiedTitle: string | null;
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
  isLocked: boolean;
  highScore: number;
  bestScoreRank: number;
  goodCnt: number;
  okCnt: number;
  ngCnt: number;
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

const { data: profileData, refresh: refreshProfile } = await useAsyncData<ProfilePayload>(
  "account-song-profile",
  () => $fetch("/api/account/bindings", { headers }),
  { default: () => ({ bindings: [], currentBinding: null }) }
);

const loadSongs = async () => {
  tableLoading.value = true;
  try {
    return await $fetch<SongsPayload>("/api/account/songs", {
      headers,
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

const applyFilters = async () => {
  page.value = 1;
  keyword.value = keywordInput.value.trim();
  await refreshSongs();
};

const changeBinding = async (bindingId: number) => {
  if (!bindingId || switchingBinding.value) return;
  switchingBinding.value = true;
  try {
    await $fetch("/api/account/bindings/current", {
      method: "POST",
      body: { bindingId }
    });
    ElMessage.success("当前绑定 ID 已切换");
    page.value = 1;
    await Promise.all([refreshProfile(), refreshSongs()]);
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || "切换绑定失败");
  } finally {
    switchingBinding.value = false;
  }
};

const openEditor = (row: SongRow) => {
  editForm.songNo = row.songNo;
  editForm.level = row.level;
  editForm.title = row.title;
  editForm.high_score = row.highScore;
  editForm.best_score_rank = row.bestScoreRank;
  editForm.good_cnt = row.goodCnt;
  editForm.ok_cnt = row.okCnt;
  editForm.ng_cnt = row.ngCnt;
  editForm.stage_cnt = row.stageCnt;
  editForm.clear_cnt = row.clearCnt;
  editForm.full_combo_cnt = row.fullComboCnt;
  editForm.dondaful_combo_cnt = row.dondafulComboCnt;
  editForm.combo_cnt = row.comboCnt;
  dialogVisible.value = true;
};

const saveSong = async () => {
  if (saving.value) return;
  saving.value = true;
  try {
    await $fetch("/api/account/songs/update", {
      method: "POST",
      body: {
        songNo: editForm.songNo,
        level: editForm.level,
        values: {
          high_score: editForm.high_score,
          best_score_rank: editForm.best_score_rank,
          good_cnt: editForm.good_cnt,
          ok_cnt: editForm.ok_cnt,
          ng_cnt: editForm.ng_cnt,
          stage_cnt: editForm.stage_cnt,
          clear_cnt: editForm.clear_cnt,
          full_combo_cnt: editForm.full_combo_cnt,
          dondaful_combo_cnt: editForm.dondaful_combo_cnt,
          combo_cnt: editForm.combo_cnt
        }
      }
    });
    ElMessage.success("谱面记录已保存");
    dialogVisible.value = false;
    await refreshSongs();
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || "保存失败");
  } finally {
    saving.value = false;
  }
};

const toggleLock = async (row: SongRow, value: boolean) => {
  const key = `${row.songNo}:${row.level}`;
  lockingKey.value = key;
  try {
    await $fetch("/api/account/songs/lock", {
      method: "POST",
      body: {
        songNo: row.songNo,
        level: row.level,
        locked: value
      }
    });
    row.isLocked = value;
    ElMessage.success(value ? "该谱面已锁定" : "该谱面已解锁");
  } catch (error: any) {
    row.isLocked = !value;
    ElMessage.error(error?.data?.statusMessage || error?.message || "锁定状态更新失败");
  } finally {
    lockingKey.value = "";
  }
};
</script>

<template>
  <div class="songs-page">
    <el-card class="panel-card control-card">
      <div class="section-title">
        <h3>本地歌曲数据</h3>
        <p>读取并编辑当前绑定 ID 的 `userdata` 成绩文件；锁定后，后续本地抓取更新不会覆盖该谱面记录。</p>
      </div>
      <div v-if="!profileData.bindings.length" class="empty-wrap">
        <el-empty description="请先在个人档案页绑定鼓众广场 ID">
          <template #extra>
            <NuxtLink to="/account/profile">
              <el-button type="primary">前往个人档案</el-button>
            </NuxtLink>
          </template>
        </el-empty>
      </div>
      <template v-else>
        <div class="toolbar-row">
          <div class="toolbar-left">
            <div class="binding-switcher">
              <span>当前绑定</span>
              <el-select
                :model-value="currentBinding?.id"
                placeholder="选择绑定 ID"
                class="binding-select"
                :loading="switchingBinding"
                @change="changeBinding"
              >
                <el-option v-for="binding in profileData.bindings" :key="binding.id" :label="binding.taikoId" :value="binding.id" />
              </el-select>
            </div>
            <div class="filter-row">
              <el-input v-model="keywordInput" placeholder="搜索曲名或 ID" clearable @keyup.enter="applyFilters" />
              <el-select v-model="levelFilter" clearable placeholder="按难度筛选" @change="applyFilters">
                <el-option :value="1" label="简单" />
                <el-option :value="2" label="一般" />
                <el-option :value="3" label="困难" />
                <el-option :value="4" label="魔王" />
                <el-option :value="5" label="里谱" />
              </el-select>
              <el-button type="primary" @click="applyFilters">搜索</el-button>
            </div>
          </div>
          <div class="toolbar-meta">
            <span>总记录数</span>
            <strong>{{ total }}</strong>
          </div>
        </div>

        <el-table v-loading="tableLoading" :data="rows" class="song-table">
          <el-table-column prop="title" label="曲名" min-width="260">
            <template #default="{ row }">
              <div class="song-title-cell">
                <strong>{{ row.title }}</strong>
                <span>{{ row.titleJp || row.songNo }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="levelLabel" label="难度" width="90" />
          <el-table-column prop="highScore" label="分数" width="110" />
          <el-table-column label="判定" width="168">
            <template #default="{ row }">
              <div class="judge-cell">良 {{ row.goodCnt }} / 可 {{ row.okCnt }} / 不可 {{ row.ngCnt }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="bestScoreRank" label="评价" width="80" />
          <el-table-column prop="maxCombo" label="最大物量" width="94" />
          <el-table-column prop="updateDatetime" label="更新时间" min-width="160" />
          <el-table-column label="锁定" width="90">
            <template #default="{ row }">
              <el-switch
                :model-value="row.isLocked"
                :loading="lockingKey === `${row.songNo}:${row.level}`"
                @update:model-value="toggleLock(row, $event)"
              />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="90" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openEditor(row)">编辑</el-button>
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

    <el-dialog v-model="dialogVisible" width="min(720px, 100%)" title="编辑谱面记录">
      <div class="dialog-head">
        <strong>{{ editForm.title }}</strong>
        <span>ID {{ editForm.songNo }} / {{ editForm.level }}</span>
      </div>
      <div class="edit-grid">
        <el-form-item label="分数">
          <el-input-number v-model="editForm.high_score" :min="0" :step="100" />
        </el-form-item>
        <el-form-item label="评价">
          <el-input-number v-model="editForm.best_score_rank" :min="0" :max="9" />
        </el-form-item>
        <el-form-item label="良">
          <el-input-number v-model="editForm.good_cnt" :min="0" />
        </el-form-item>
        <el-form-item label="可">
          <el-input-number v-model="editForm.ok_cnt" :min="0" />
        </el-form-item>
        <el-form-item label="不可">
          <el-input-number v-model="editForm.ng_cnt" :min="0" />
        </el-form-item>
        <el-form-item label="游玩次数">
          <el-input-number v-model="editForm.stage_cnt" :min="0" />
        </el-form-item>
        <el-form-item label="过关次数">
          <el-input-number v-model="editForm.clear_cnt" :min="0" />
        </el-form-item>
        <el-form-item label="全连次数">
          <el-input-number v-model="editForm.full_combo_cnt" :min="0" />
        </el-form-item>
        <el-form-item label="全良次数">
          <el-input-number v-model="editForm.dondaful_combo_cnt" :min="0" />
        </el-form-item>
        <el-form-item label="最大连击">
          <el-input-number v-model="editForm.combo_cnt" :min="0" />
        </el-form-item>
      </div>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveSong">保存</el-button>
      </template>
    </el-dialog>
  </div>
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
  grid-template-columns: minmax(0, 1fr) 140px auto;
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

.song-title-cell span,
.judge-cell {
  color: #7d6a5a;
  font-size: 13px;
}

.pagination-row {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.dialog-head {
  margin-bottom: 14px;
  display: grid;
  gap: 4px;
}

.dialog-head span {
  color: #7d6a5a;
}

.edit-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 18px;
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

  .edit-grid {
    grid-template-columns: 1fr;
  }
}
</style>
