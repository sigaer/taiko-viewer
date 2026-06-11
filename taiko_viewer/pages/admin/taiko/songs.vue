<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";

defineI18nRoute(false);

definePageMeta({
  layout: "admin-taiko",
  middleware: "admin-auth"
});

useHead({
  title: "歌曲数据"
});

type AdminSongListPayload = {
  total: number;
  page: number;
  pageSize: number;
  typeOptions: string[];
  items: Array<Record<string, any>>;
};

const apiFetch = useAdminApiFetch();
const loading = ref(false);
const showDialog = ref(false);
const editingSongId = ref<number | null>(null);
const filters = reactive({
  keyword: "",
  type: "",
  shelfStatus: ""
});
const pagination = reactive({
  page: 1,
  pageSize: 20
});

const form = reactive<Record<string, any>>({
  id: "",
  sort: "",
  open_day: "",
  type: "",
  tag: "",
  song_name: "",
  song_name_jp: "",
  subtitle: "",
  bpm: "",
  shelf_status: 0,
  level_1: "",
  level_2: "",
  level_3: "",
  level_4: "",
  level_5: "",
  version: "",
  artists: "",
  max_combo: ""
});

const loadSongs = () =>
  apiFetch<AdminSongListPayload>("/api/admin/songs", {
    query: {
      ...filters,
      page: pagination.page,
      pageSize: pagination.pageSize
    }
  });

const { data, refresh } = await useAsyncData<AdminSongListPayload>(
  "admin-taiko-songs",
  () => loadSongs(),
  { default: () => ({ total: 0, page: 1, pageSize: 20, typeOptions: [], items: [] }) }
);

const rows = computed(() => data.value.items || []);
const dialogTitle = computed(() => (editingSongId.value ? `编辑歌曲 #${editingSongId.value}` : "新增歌曲"));

const resetForm = () => {
  editingSongId.value = null;
  Object.assign(form, {
    id: "",
    sort: "",
    open_day: "",
    type: "",
    tag: "",
    song_name: "",
    song_name_jp: "",
    subtitle: "",
    bpm: "",
    shelf_status: 0,
    level_1: "",
    level_2: "",
    level_3: "",
    level_4: "",
    level_5: "",
    version: "",
    artists: "",
    max_combo: ""
  });
};

const openCreateDialog = () => {
  resetForm();
  showDialog.value = true;
};

const openEditDialog = (row: Record<string, any>) => {
  editingSongId.value = Number(row.id);
  Object.assign(form, {
    ...row,
    version: Array.isArray(row.version) ? row.version.join(", ") : row.version || "",
    artists: Array.isArray(row.artists) ? row.artists.join(", ") : row.artists || "",
    max_combo: Array.isArray(row.max_combo) ? row.max_combo.join(", ") : row.max_combo || ""
  });
  showDialog.value = true;
};

const submitForm = async () => {
  loading.value = true;
  try {
    await apiFetch(editingSongId.value ? "/api/admin/songs/update" : "/api/admin/songs/create", {
      method: "POST",
      body: {
        ...form
      }
    });
    ElMessage.success(editingSongId.value ? "歌曲已更新" : "歌曲已新增");
    showDialog.value = false;
    await refresh();
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || "保存失败");
  } finally {
    loading.value = false;
  }
};

const removeSong = async (row: Record<string, any>) => {
  try {
    await ElMessageBox.confirm(
      `确定删除歌曲 ${row.song_name}（ID ${row.id}）吗？存在攻略、rating、别名或封面依赖时会被阻止。`,
      "删除确认",
      {
        type: "warning"
      }
    );
    await apiFetch("/api/admin/songs/delete", {
      method: "POST",
      body: {
        songId: row.id
      }
    });
    ElMessage.success("歌曲已删除");
    await refresh();
  } catch (error: any) {
    if (error === "cancel") return;
    ElMessage.error(error?.data?.statusMessage || error?.message || "删除失败");
  }
};

const exportSongs = async () => {
  try {
    const payload = await apiFetch("/api/admin/songs/export");
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `song_data_${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(href);
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || "导出失败");
  }
};

const applyFilters = async () => {
  pagination.page = 1;
  await refresh();
};

const levelText = (row: Record<string, any>) =>
  [row.level_1, row.level_2, row.level_3, row.level_4, row.level_5].map((item) => item || "-").join(" / ");
</script>

<template>
  <div class="admin-page-stack">
    <el-card class="admin-panel-card">
      <div class="admin-filter-grid">
        <el-input v-model="filters.keyword" placeholder="按曲名 / ID / 艺术家检索" clearable @keyup.enter="applyFilters" />
        <el-select v-model="filters.type" clearable placeholder="分类">
          <el-option v-for="item in data.typeOptions" :key="item" :label="item" :value="item" />
        </el-select>
        <el-select v-model="filters.shelfStatus" clearable placeholder="上下架状态">
          <el-option label="已收录" value="0" />
          <el-option label="未收录 / 下架" value="1" />
        </el-select>
        <div class="admin-filter-actions">
          <el-button @click="applyFilters">筛选</el-button>
          <el-button type="primary" @click="openCreateDialog">新增歌曲</el-button>
          <el-button @click="exportSongs">导出 JSON</el-button>
        </div>
      </div>
    </el-card>

    <el-card class="admin-panel-card">
      <el-table :data="rows" stripe>
        <el-table-column prop="id" label="ID" width="92" />
        <el-table-column prop="song_name" label="曲名" min-width="220" />
        <el-table-column prop="song_name_jp" label="日文名" min-width="220" />
        <el-table-column prop="type" label="分类" width="140" />
        <el-table-column label="星级" min-width="180">
          <template #default="{ row }">{{ levelText(row) }}</template>
        </el-table-column>
        <el-table-column label="依赖" min-width="200">
          <template #default="{ row }">
            <div class="admin-tag-row">
              <el-tag size="small" :type="row.hasCover ? 'success' : 'info'">封面 {{ row.hasCover ? "有" : "无" }}</el-tag>
              <el-tag size="small" :type="row.aliasCount ? 'warning' : 'info'">别名 {{ row.aliasCount }}</el-tag>
              <el-tag size="small" :type="row.guideMusicExists || row.guideDifficultyCount ? 'danger' : 'info'">
                攻略 {{ row.guideDifficultyCount || 0 }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <div class="admin-table-actions">
              <el-button link type="primary" @click="openEditDialog(row)">编辑</el-button>
              <el-button link type="danger" @click="removeSong(row)">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="admin-pagination">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="data.total"
          layout="total, prev, pager, next, sizes"
          @current-change="refresh()"
          @size-change="refresh()"
        />
      </div>
    </el-card>

    <el-dialog v-model="showDialog" :title="dialogTitle" width="860px">
      <el-form label-position="top" class="admin-song-form">
        <el-form-item label="歌曲 ID">
          <el-input v-model="form.id" :disabled="Boolean(editingSongId)" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input v-model="form.sort" />
        </el-form-item>
        <el-form-item label="收录日期">
          <el-input v-model="form.open_day" placeholder="MM/DD/YYYY" />
        </el-form-item>
        <el-form-item label="分类">
          <el-input v-model="form.type" />
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="form.tag" />
        </el-form-item>
        <el-form-item label="中文曲名">
          <el-input v-model="form.song_name" />
        </el-form-item>
        <el-form-item label="日文曲名">
          <el-input v-model="form.song_name_jp" />
        </el-form-item>
        <el-form-item label="副标题">
          <el-input v-model="form.subtitle" />
        </el-form-item>
        <el-form-item label="BPM">
          <el-input v-model="form.bpm" />
        </el-form-item>
        <el-form-item label="收录状态">
          <el-select v-model="form.shelf_status">
            <el-option label="已收录" :value="0" />
            <el-option label="未收录 / 下架" :value="1" />
          </el-select>
        </el-form-item>
        <el-form-item label="简单">
          <el-input v-model="form.level_1" />
        </el-form-item>
        <el-form-item label="普通">
          <el-input v-model="form.level_2" />
        </el-form-item>
        <el-form-item label="困难">
          <el-input v-model="form.level_3" />
        </el-form-item>
        <el-form-item label="鬼">
          <el-input v-model="form.level_4" />
        </el-form-item>
        <el-form-item label="里">
          <el-input v-model="form.level_5" />
        </el-form-item>
        <el-form-item label="版本（逗号分隔）">
          <el-input v-model="form.version" />
        </el-form-item>
        <el-form-item label="艺术家（逗号分隔）">
          <el-input v-model="form.artists" />
        </el-form-item>
        <el-form-item label="物量（5 难度，逗号分隔）">
          <el-input v-model="form.max_combo" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" :loading="loading" @click="submitForm">保存</el-button>
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

.admin-filter-grid {
  display: grid;
  grid-template-columns: 1.8fr 1fr 1fr auto;
  gap: 12px;
}

.admin-filter-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.admin-tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.admin-table-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.admin-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 18px;
}

.admin-song-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 14px;
}

@media (max-width: 980px) {
  .admin-filter-grid,
  .admin-song-form {
    grid-template-columns: 1fr;
  }

  .admin-filter-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }
}
</style>
