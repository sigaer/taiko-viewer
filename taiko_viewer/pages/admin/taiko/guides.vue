<script setup lang="ts">
import { reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";

defineI18nRoute(false);

definePageMeta({
  layout: "admin-taiko",
  middleware: "admin-auth"
});

useHead({
  title: "谱面攻略"
});

type GuideOverview = {
  musicCount: number;
  difficultyCount: number;
  countsByDifficulty: Record<string, number>;
};

type GuideListPayload = {
  total: number;
  page: number;
  pageSize: number;
  categories?: string[];
  items: Array<Record<string, any>>;
};

const apiFetch = useAdminApiFetch();
const loading = ref(false);
const activeTab = ref("music");
const musicDialogVisible = ref(false);
const difficultyDialogVisible = ref(false);
const editingMusicId = ref<number | null>(null);
const editingDifficultyId = ref<number | null>(null);

const musicFilters = reactive({
  keyword: "",
  category: "",
  page: 1,
  pageSize: 20
});

const difficultyFilters = reactive({
  keyword: "",
  difficultyType: "",
  level: "",
  levelTag: "",
  page: 1,
  pageSize: 20
});

const musicForm = reactive<Record<string, any>>({
  id: "",
  title: "",
  titleJp: "",
  bpm: "",
  category: ""
});

const difficultyForm = reactive<Record<string, any>>({
  id: "",
  musicId: "",
  difficultyType: 4,
  level: "",
  levelTag: 4,
  tag: "",
  feature: "",
  noteCount: "",
  fumen: "",
  maxScore: "0"
});

const { data: overview, refresh: refreshOverview } = await useAsyncData<GuideOverview>(
  "admin-guide-overview",
  () => apiFetch("/api/admin/guides/overview"),
  {
    default: () => ({ musicCount: 0, difficultyCount: 0, countsByDifficulty: {} })
  }
);

const { data: musicList, refresh: refreshMusic } = await useAsyncData<GuideListPayload>(
  "admin-guide-musics",
  () =>
    apiFetch("/api/admin/guides/musics", {
      query: musicFilters
    }),
  {
    default: () => ({ total: 0, page: 1, pageSize: 20, categories: [], items: [] })
  }
);

const { data: difficultyList, refresh: refreshDifficulties } = await useAsyncData<GuideListPayload>(
  "admin-guide-difficulties",
  () =>
    apiFetch("/api/admin/guides/difficulties", {
      query: difficultyFilters
    }),
  {
    default: () => ({ total: 0, page: 1, pageSize: 20, items: [] })
  }
);

const refreshAll = async () => {
  await Promise.all([refreshOverview(), refreshMusic(), refreshDifficulties()]);
};

const openMusicCreate = () => {
  editingMusicId.value = null;
  Object.assign(musicForm, {
    id: "",
    title: "",
    titleJp: "",
    bpm: "",
    category: ""
  });
  musicDialogVisible.value = true;
};

const openMusicEdit = (row: Record<string, any>) => {
  editingMusicId.value = Number(row.id);
  Object.assign(musicForm, row);
  musicDialogVisible.value = true;
};

const submitMusic = async () => {
  loading.value = true;
  try {
    await apiFetch(editingMusicId.value ? "/api/admin/guides/music/update" : "/api/admin/guides/music/create", {
      method: "POST",
      body: musicForm
    });
    ElMessage.success(editingMusicId.value ? "攻略歌曲已更新" : "攻略歌曲已新增");
    musicDialogVisible.value = false;
    await refreshAll();
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || "保存失败");
  } finally {
    loading.value = false;
  }
};

const removeMusic = async (row: Record<string, any>) => {
  try {
    await ElMessageBox.confirm(`确定删除攻略歌曲 ${row.title}（ID ${row.id}）吗？`, "删除确认", { type: "warning" });
    await apiFetch("/api/admin/guides/music/delete", {
      method: "POST",
      body: { songId: row.id }
    });
    ElMessage.success("攻略歌曲已删除");
    await refreshAll();
  } catch (error: any) {
    if (error === "cancel") return;
    ElMessage.error(error?.data?.statusMessage || error?.message || "删除失败");
  }
};

const openDifficultyCreate = () => {
  editingDifficultyId.value = null;
  Object.assign(difficultyForm, {
    id: "",
    musicId: "",
    difficultyType: 4,
    level: "",
    levelTag: 4,
    tag: "",
    feature: "",
    noteCount: "",
    fumen: "",
    maxScore: "0"
  });
  difficultyDialogVisible.value = true;
};

const openDifficultyEdit = (row: Record<string, any>) => {
  editingDifficultyId.value = Number(row.id);
  Object.assign(difficultyForm, {
    ...row,
    musicId: row.musicId,
    difficultyType: row.difficultyType,
    level: row.level,
    levelTag: row.levelTag
  });
  difficultyDialogVisible.value = true;
};

const submitDifficulty = async () => {
  loading.value = true;
  try {
    await apiFetch(
      editingDifficultyId.value ? "/api/admin/guides/difficulty/update" : "/api/admin/guides/difficulty/create",
      {
        method: "POST",
        body: difficultyForm
      }
    );
    ElMessage.success(editingDifficultyId.value ? "谱面攻略已更新" : "谱面攻略已新增");
    difficultyDialogVisible.value = false;
    await refreshAll();
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || "保存失败");
  } finally {
    loading.value = false;
  }
};

const removeDifficulty = async (row: Record<string, any>) => {
  try {
    await ElMessageBox.confirm(`确定删除谱面攻略 #${row.id} 吗？`, "删除确认", { type: "warning" });
    await apiFetch("/api/admin/guides/difficulty/delete", {
      method: "POST",
      body: { difficultyId: row.id }
    });
    ElMessage.success("谱面攻略已删除");
    await refreshAll();
  } catch (error: any) {
    if (error === "cancel") return;
    ElMessage.error(error?.data?.statusMessage || error?.message || "删除失败");
  }
};
</script>

<template>
  <div class="admin-page-stack">
    <div class="admin-metric-grid">
      <AdminMetricCard label="攻略歌曲" :value="overview.musicCount" hint="远端 music 总数" accent="gold" />
      <AdminMetricCard label="谱面攻略" :value="overview.difficultyCount" hint="远端 musicDifficulty 总数" accent="rose" />
      <AdminMetricCard
        v-for="(count, label) in overview.countsByDifficulty"
        :key="label"
        :label="label"
        :value="count"
        hint="按难度聚合"
        accent="teal"
      />
    </div>

    <el-card class="admin-panel-card">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="攻略歌曲" name="music">
          <div class="admin-filter-grid">
            <el-input v-model="musicFilters.keyword" placeholder="按曲名 / ID / BPM 检索" clearable />
            <el-select v-model="musicFilters.category" clearable placeholder="分类">
              <el-option v-for="item in musicList.categories || []" :key="item" :label="item" :value="item" />
            </el-select>
            <div class="admin-filter-actions">
              <el-button @click="refreshMusic()">筛选</el-button>
              <el-button type="primary" @click="openMusicCreate">新增攻略歌曲</el-button>
            </div>
          </div>

          <el-table :data="musicList.items" stripe>
            <el-table-column prop="id" label="ID" width="90" />
            <el-table-column prop="title" label="中文曲名" min-width="200" />
            <el-table-column prop="titleJp" label="日文曲名" min-width="220" />
            <el-table-column prop="bpm" label="BPM" width="120" />
            <el-table-column prop="category" label="分类" width="160" />
            <el-table-column label="操作" width="170" fixed="right">
              <template #default="{ row }">
                <div class="admin-table-actions">
                  <el-button link type="primary" @click="openMusicEdit(row)">编辑</el-button>
                  <el-button link type="danger" @click="removeMusic(row)">删除</el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="谱面攻略" name="difficulty">
          <div class="admin-filter-grid admin-filter-grid--wide">
            <el-input v-model="difficultyFilters.keyword" placeholder="按曲名 / 标签 / 物量检索" clearable />
            <el-select v-model="difficultyFilters.difficultyType" clearable placeholder="难度">
              <el-option label="简单" value="1" />
              <el-option label="普通" value="2" />
              <el-option label="困难" value="3" />
              <el-option label="鬼" value="4" />
              <el-option label="里" value="5" />
            </el-select>
            <el-input v-model="difficultyFilters.level" placeholder="定数" />
            <el-input v-model="difficultyFilters.levelTag" placeholder="偏差" />
            <div class="admin-filter-actions">
              <el-button @click="refreshDifficulties()">筛选</el-button>
              <el-button type="primary" @click="openDifficultyCreate">新增谱面攻略</el-button>
            </div>
          </div>

          <el-table :data="difficultyList.items" stripe>
            <el-table-column prop="id" label="ID" width="90" />
            <el-table-column label="歌曲" min-width="220">
              <template #default="{ row }">
                <div class="admin-title-pair">
                  <strong>{{ row.music?.title || `#${row.musicId}` }}</strong>
                  <span>{{ row.music?.titleJp || "" }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="difficultyLabel" label="难度" width="92" />
            <el-table-column prop="level" label="定数" width="82" />
            <el-table-column prop="levelTag" label="偏差" width="82" />
            <el-table-column prop="noteCount" label="物量" width="92" />
            <el-table-column prop="tag" label="标签" min-width="120" />
            <el-table-column prop="feature" label="攻略摘要" min-width="260" show-overflow-tooltip />
            <el-table-column label="操作" width="170" fixed="right">
              <template #default="{ row }">
                <div class="admin-table-actions">
                  <el-button link type="primary" @click="openDifficultyEdit(row)">编辑</el-button>
                  <el-button link type="danger" @click="removeDifficulty(row)">删除</el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-dialog v-model="musicDialogVisible" :title="editingMusicId ? '编辑攻略歌曲' : '新增攻略歌曲'" width="720px">
      <el-form label-position="top" class="admin-form-grid">
        <el-form-item label="歌曲 ID">
          <el-input v-model="musicForm.id" :disabled="Boolean(editingMusicId)" />
        </el-form-item>
        <el-form-item label="BPM">
          <el-input v-model="musicForm.bpm" />
        </el-form-item>
        <el-form-item label="中文曲名">
          <el-input v-model="musicForm.title" />
        </el-form-item>
        <el-form-item label="日文曲名">
          <el-input v-model="musicForm.titleJp" />
        </el-form-item>
        <el-form-item label="分类" class="admin-form-grid__full">
          <el-input v-model="musicForm.category" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="musicDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="loading" @click="submitMusic">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="difficultyDialogVisible" :title="editingDifficultyId ? '编辑谱面攻略' : '新增谱面攻略'" width="860px">
      <el-form label-position="top" class="admin-form-grid">
        <el-form-item label="攻略 ID" v-if="editingDifficultyId">
          <el-input v-model="difficultyForm.id" disabled />
        </el-form-item>
        <el-form-item label="歌曲 ID">
          <el-input v-model="difficultyForm.musicId" />
        </el-form-item>
        <el-form-item label="难度类型">
          <el-select v-model="difficultyForm.difficultyType">
            <el-option label="简单" :value="1" />
            <el-option label="普通" :value="2" />
            <el-option label="困难" :value="3" />
            <el-option label="鬼" :value="4" />
            <el-option label="里" :value="5" />
          </el-select>
        </el-form-item>
        <el-form-item label="定数">
          <el-input v-model="difficultyForm.level" />
        </el-form-item>
        <el-form-item label="偏差">
          <el-input v-model="difficultyForm.levelTag" />
        </el-form-item>
        <el-form-item label="物量">
          <el-input v-model="difficultyForm.noteCount" />
        </el-form-item>
        <el-form-item label="标签" class="admin-form-grid__full">
          <el-input v-model="difficultyForm.tag" />
        </el-form-item>
        <el-form-item label="攻略正文" class="admin-form-grid__full">
          <el-input v-model="difficultyForm.feature" type="textarea" :rows="8" />
        </el-form-item>
        <el-form-item label="谱面图链接" class="admin-form-grid__full">
          <el-input v-model="difficultyForm.fumen" />
        </el-form-item>
        <el-form-item label="最大分数">
          <el-input v-model="difficultyForm.maxScore" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="difficultyDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="loading" @click="submitDifficulty">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.admin-page-stack {
  display: grid;
  gap: 20px;
}

.admin-panel-card {
  border-radius: 24px;
  border: none;
}

.admin-metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.admin-filter-grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr auto;
  gap: 12px;
  margin-bottom: 18px;
}

.admin-filter-grid--wide {
  grid-template-columns: 1.6fr repeat(3, 120px) auto;
}

.admin-filter-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.admin-table-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.admin-title-pair {
  display: grid;
  gap: 4px;
}

.admin-title-pair span {
  color: #7c6f5f;
  font-size: 12px;
}

.admin-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 14px;
}

.admin-form-grid__full {
  grid-column: 1 / -1;
}

@media (max-width: 980px) {
  .admin-metric-grid,
  .admin-filter-grid,
  .admin-filter-grid--wide,
  .admin-form-grid {
    grid-template-columns: 1fr;
  }

  .admin-filter-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }
}
</style>
