<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";

defineI18nRoute(false);

definePageMeta({
  layout: "admin-taiko",
  middleware: "admin-auth"
});

useHead({
  title: "你画我猜管理"
});

type DrawGuessListPayload = {
  summary: {
    totalRecords: number;
    activeRecords: number;
    inactiveRecords: number;
    reportedRecords: number;
    guessUsers: number;
  };
  total: number;
  page: number;
  pageSize: number;
  items: Array<{
    id: number;
    songTitle: string;
    songIds: number[];
    uploaderQq: string;
    uploaderNickname: string;
    uploaderGroupId: string;
    uploaderGroupName: string;
    imageUrl: string;
    imageExists: boolean;
    active: boolean;
    guessCorrectCount: number;
    guessWrongCount: number;
    likeCount: number;
    reportCount: number;
    createdAt: string;
  }>;
};

const apiFetch = useAdminApiFetch();
const loading = ref(false);
const showEditor = ref(false);
const editingId = ref<number | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const selectedFile = ref<File | null>(null);
const selectedPreviewUrl = ref("");
const filters = reactive({
  keyword: "",
  active: "",
  reported: "",
  page: 1,
  pageSize: 20
});

const editorForm = reactive({
  id: "",
  songTitle: "",
  songIds: "",
  uploaderQq: "",
  uploaderNickname: "",
  uploaderGroupId: "",
  uploaderGroupName: "",
  active: true,
  guessCorrectCount: 0,
  guessWrongCount: 0,
  likeCount: 0,
  reportCount: 0,
  imageUrl: "",
  imageExists: false
});

const { data, refresh } = await useAsyncData<DrawGuessListPayload>(
  "admin-draw-guess-list",
  () =>
    apiFetch("/api/admin/draw-guess", {
      query: filters
    }),
  {
    default: () => ({
      summary: {
        totalRecords: 0,
        activeRecords: 0,
        inactiveRecords: 0,
        reportedRecords: 0,
        guessUsers: 0
      },
      total: 0,
      page: 1,
      pageSize: 20,
      items: []
    })
  }
);

const isEditing = computed(() => editingId.value !== null);
const currentPreviewUrl = computed(() => selectedPreviewUrl.value || editorForm.imageUrl);

const resetSelectedFile = () => {
  selectedFile.value = null;
  if (selectedPreviewUrl.value) {
    URL.revokeObjectURL(selectedPreviewUrl.value);
    selectedPreviewUrl.value = "";
  }
  if (fileInput.value) fileInput.value.value = "";
};

const resetEditor = () => {
  editingId.value = null;
  Object.assign(editorForm, {
    id: "",
    songTitle: "",
    songIds: "",
    uploaderQq: "",
    uploaderNickname: "",
    uploaderGroupId: "",
    uploaderGroupName: "",
    active: true,
    guessCorrectCount: 0,
    guessWrongCount: 0,
    likeCount: 0,
    reportCount: 0,
    imageUrl: "",
    imageExists: false
  });
  resetSelectedFile();
};

const openCreateDialog = () => {
  resetEditor();
  showEditor.value = true;
};

const openEditDialog = (row: DrawGuessListPayload["items"][number]) => {
  resetEditor();
  editingId.value = row.id;
  Object.assign(editorForm, {
    id: String(row.id),
    songTitle: row.songTitle,
    songIds: row.songIds.join(", "),
    uploaderQq: row.uploaderQq,
    uploaderNickname: row.uploaderNickname,
    uploaderGroupId: row.uploaderGroupId,
    uploaderGroupName: row.uploaderGroupName,
    active: row.active,
    guessCorrectCount: row.guessCorrectCount,
    guessWrongCount: row.guessWrongCount,
    likeCount: row.likeCount,
    reportCount: row.reportCount,
    imageUrl: row.imageUrl,
    imageExists: row.imageExists
  });
  showEditor.value = true;
};

const pickFile = () => {
  fileInput.value?.click();
};

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0] || null;
  resetSelectedFile();
  if (!file) return;
  selectedFile.value = file;
  selectedPreviewUrl.value = URL.createObjectURL(file);
};

const submitEditor = async () => {
  if (!isEditing.value && !selectedFile.value) {
    ElMessage.warning("新建题目时请先上传题面图片");
    return;
  }
  loading.value = true;
  try {
    const body = new FormData();
    if (isEditing.value) {
      body.append("id", editorForm.id);
    }
    body.append("songTitle", editorForm.songTitle);
    body.append("songIds", editorForm.songIds);
    body.append("uploaderQq", editorForm.uploaderQq);
    body.append("uploaderNickname", editorForm.uploaderNickname);
    body.append("uploaderGroupId", editorForm.uploaderGroupId);
    body.append("uploaderGroupName", editorForm.uploaderGroupName);
    body.append("active", editorForm.active ? "1" : "0");
    body.append("guessCorrectCount", String(editorForm.guessCorrectCount));
    body.append("guessWrongCount", String(editorForm.guessWrongCount));
    body.append("likeCount", String(editorForm.likeCount));
    body.append("reportCount", String(editorForm.reportCount));
    if (selectedFile.value) {
      body.append("file", selectedFile.value);
    }
    await apiFetch(isEditing.value ? "/api/admin/draw-guess/update" : "/api/admin/draw-guess/create", {
      method: "POST",
      body
    });
    ElMessage.success(isEditing.value ? "题目记录已更新" : "题目记录已创建");
    showEditor.value = false;
    resetEditor();
    await refresh();
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || "保存失败");
  } finally {
    loading.value = false;
  }
};

const removeRecord = async (row: DrawGuessListPayload["items"][number]) => {
  try {
    await ElMessageBox.confirm(`确定删除你画我猜题目 #${row.id} 吗？对应题面图片也会一并删除。`, "删除确认", {
      type: "warning"
    });
    await apiFetch("/api/admin/draw-guess/delete", {
      method: "POST",
      body: {
        id: row.id
      }
    });
    ElMessage.success("题目记录已删除");
    await refresh();
  } catch (error: any) {
    if (error === "cancel") return;
    ElMessage.error(error?.data?.statusMessage || error?.message || "删除失败");
  }
};

const formatSongIds = (songIds: number[]) => songIds.map((item) => `#${item}`).join(", ");

const formatUploaderDetail = (row: DrawGuessListPayload["items"][number]) => {
  const parts: string[] = [];
  if (row.uploaderQq) parts.push(`QQ ${row.uploaderQq}`);
  if (row.uploaderGroupName) parts.push(row.uploaderGroupName);
  if (row.uploaderGroupId) parts.push(`群 ${row.uploaderGroupId}`);
  return parts.join(" / ") || "未标注来源";
};

onBeforeUnmount(() => {
  resetSelectedFile();
});
</script>

<template>
  <div class="admin-page-stack">
    <section class="admin-metric-grid">
      <AdminMetricCard label="题库总数" :value="data.summary.totalRecords" hint="records.json" accent="gold" />
      <AdminMetricCard label="启用题目" :value="data.summary.activeRecords" hint="active = true" accent="teal" />
      <AdminMetricCard label="隐藏题目" :value="data.summary.inactiveRecords" hint="active = false" accent="rose" />
      <AdminMetricCard label="被举报题目" :value="data.summary.reportedRecords" hint="report_count > 0" accent="indigo" />
      <AdminMetricCard label="参与猜歌用户" :value="data.summary.guessUsers" hint="user_guess_stats" />
    </section>

    <el-card class="admin-panel-card">
      <div class="admin-filter-grid admin-filter-grid--draw-guess">
        <el-input
          v-model="filters.keyword"
          placeholder="按题号 / 曲名 / 曲 ID / 投稿者 / 群名检索"
          clearable
          @keyup.enter="refresh()"
        />
        <el-select v-model="filters.active" clearable placeholder="启用状态">
          <el-option label="启用中" value="1" />
          <el-option label="已隐藏" value="0" />
        </el-select>
        <el-select v-model="filters.reported" clearable placeholder="举报状态">
          <el-option label="有举报" value="1" />
          <el-option label="无举报" value="0" />
        </el-select>
        <div class="admin-filter-actions">
          <el-button @click="refresh()">筛选</el-button>
          <el-button type="primary" @click="openCreateDialog">新增题目</el-button>
        </div>
      </div>
    </el-card>

    <el-card class="admin-panel-card">
      <el-table :data="data.items" stripe>
        <el-table-column prop="id" label="题号" width="88" />
        <el-table-column label="题面" width="120">
          <template #default="{ row }">
            <button type="button" class="draw-guess-thumb" @click="openEditDialog(row)">
              <img v-if="row.imageExists" :src="row.imageUrl" :alt="row.songTitle" />
              <span v-else>缺图</span>
            </button>
          </template>
        </el-table-column>
        <el-table-column label="歌曲信息" min-width="240">
          <template #default="{ row }">
            <div class="admin-title-pair">
              <strong>{{ row.songTitle || `#${row.id}` }}</strong>
              <span>{{ formatSongIds(row.songIds) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="投稿来源" min-width="240">
          <template #default="{ row }">
            <div class="admin-title-pair">
              <strong>{{ row.uploaderNickname || "未标注投稿者" }}</strong>
              <span>{{ formatUploaderDetail(row) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="统计" width="200">
          <template #default="{ row }">
            <div class="draw-guess-stats">
              <span>猜对 {{ row.guessCorrectCount }}</span>
              <span>猜错 {{ row.guessWrongCount }}</span>
              <span>点赞 {{ row.likeCount }}</span>
              <span>举报 {{ row.reportCount }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="140">
          <template #default="{ row }">
            <div class="admin-tag-row admin-tag-row--compact">
              <el-tag :type="row.active ? 'success' : 'info'">{{ row.active ? "启用中" : "已隐藏" }}</el-tag>
              <el-tag v-if="row.reportCount > 0" type="danger">已举报</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180" />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <div class="admin-table-actions">
              <el-button link type="primary" @click="openEditDialog(row)">编辑</el-button>
              <el-button link type="danger" @click="removeRecord(row)">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="admin-pagination">
        <el-pagination
          v-model:current-page="filters.page"
          v-model:page-size="filters.pageSize"
          :total="data.total"
          layout="total, prev, pager, next, sizes"
          @current-change="refresh()"
          @size-change="refresh()"
        />
      </div>
    </el-card>

    <el-dialog
      v-model="showEditor"
      :title="isEditing ? `编辑题目 #${editorForm.id}` : '新增你画我猜题目'"
      width="980px"
      @closed="resetEditor"
    >
      <div class="draw-guess-editor">
        <div class="draw-guess-editor__preview">
          <div class="draw-guess-editor__preview-head">
            <span>题面预览</span>
            <small>{{ selectedFile?.name || (editorForm.imageExists ? "当前题面" : "尚未上传") }}</small>
          </div>
          <div class="draw-guess-editor__preview-card">
            <img v-if="currentPreviewUrl" :src="currentPreviewUrl" :alt="editorForm.songTitle || 'draw guess preview'" />
            <span v-else>等待上传图片</span>
          </div>
          <input ref="fileInput" class="hidden-file-input" type="file" accept="image/*" @change="handleFileChange" />
          <div class="file-picker-row">
            <el-button @click="pickFile">{{ isEditing ? "替换题面图片" : "上传题面图片" }}</el-button>
            <span>{{ selectedFile?.name || (editorForm.imageExists ? "保留当前图片" : "未选择文件") }}</span>
          </div>
        </div>

        <el-form class="draw-guess-editor__form" label-position="top">
          <div class="draw-guess-editor__grid">
            <el-form-item label="歌曲 ID 列表">
              <el-input v-model="editorForm.songIds" placeholder="支持逗号分隔，例如 66, 288" />
            </el-form-item>
            <el-form-item label="题目曲名">
              <el-input v-model="editorForm.songTitle" placeholder="留空时会尝试按歌曲 ID 自动推断" />
            </el-form-item>
            <el-form-item label="投稿者 QQ">
              <el-input v-model="editorForm.uploaderQq" placeholder="可留空" />
            </el-form-item>
            <el-form-item label="投稿者昵称">
              <el-input v-model="editorForm.uploaderNickname" placeholder="可留空" />
            </el-form-item>
            <el-form-item label="投稿群号">
              <el-input v-model="editorForm.uploaderGroupId" placeholder="可留空" />
            </el-form-item>
            <el-form-item label="投稿群名">
              <el-input v-model="editorForm.uploaderGroupName" placeholder="可留空" />
            </el-form-item>
          </div>

          <div class="draw-guess-editor__switch-row">
            <span>启用题目</span>
            <el-switch v-model="editorForm.active" />
          </div>

          <div class="draw-guess-editor__stats-grid">
            <el-form-item label="猜对次数">
              <el-input-number v-model="editorForm.guessCorrectCount" :min="0" />
            </el-form-item>
            <el-form-item label="猜错次数">
              <el-input-number v-model="editorForm.guessWrongCount" :min="0" />
            </el-form-item>
            <el-form-item label="点赞次数">
              <el-input-number v-model="editorForm.likeCount" :min="0" />
            </el-form-item>
            <el-form-item label="举报次数">
              <el-input-number v-model="editorForm.reportCount" :min="0" />
            </el-form-item>
          </div>
        </el-form>
      </div>

      <template #footer>
        <el-button @click="showEditor = false">取消</el-button>
        <el-button type="primary" :loading="loading" @click="submitEditor">{{ isEditing ? "保存修改" : "创建题目" }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.admin-page-stack {
  display: grid;
  gap: 20px;
}

.admin-metric-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 16px;
}

.admin-panel-card {
  border-radius: 24px;
  border: none;
}

.admin-filter-grid {
  display: grid;
  gap: 12px;
}

.admin-filter-grid--draw-guess {
  grid-template-columns: minmax(0, 1.3fr) 160px 160px auto;
}

.admin-filter-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.admin-title-pair {
  display: grid;
  gap: 4px;
}

.admin-title-pair strong {
  color: #1f2d3d;
}

.admin-title-pair span {
  color: #7a6d5b;
  font-size: 13px;
  line-height: 1.5;
}

.admin-tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.admin-tag-row--compact {
  gap: 6px;
}

.admin-table-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.draw-guess-thumb {
  width: 84px;
  height: 84px;
  border: none;
  border-radius: 18px;
  background: rgba(243, 235, 219, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
  padding: 0;
  color: #7d5f37;
}

.draw-guess-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.draw-guess-stats {
  display: grid;
  gap: 4px;
  color: #5f5a53;
  font-size: 13px;
}

.admin-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 18px;
}

.draw-guess-editor {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 24px;
}

.draw-guess-editor__preview {
  display: grid;
  align-content: start;
  gap: 14px;
}

.draw-guess-editor__preview-head {
  display: grid;
  gap: 4px;
}

.draw-guess-editor__preview-head span {
  font-weight: 700;
  color: #24324b;
}

.draw-guess-editor__preview-head small {
  color: #80674b;
}

.draw-guess-editor__preview-card {
  aspect-ratio: 1 / 1;
  border-radius: 24px;
  overflow: hidden;
  background:
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.38), transparent 36%),
    linear-gradient(145deg, rgba(60, 41, 14, 0.98), rgba(141, 100, 34, 0.88));
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 249, 240, 0.86);
  text-align: center;
  padding: 20px;
}

.draw-guess-editor__preview-card img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: rgba(255, 250, 240, 0.12);
  border-radius: 18px;
}

.draw-guess-editor__form {
  display: grid;
  gap: 16px;
}

.draw-guess-editor__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 14px;
}

.draw-guess-editor__switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 52px;
  padding: 0 14px;
  border-radius: 18px;
  background: rgba(242, 235, 222, 0.9);
  color: #3f2f1c;
  font-weight: 600;
}

.draw-guess-editor__stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0 14px;
}

.hidden-file-input {
  display: none;
}

.file-picker-row {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #695841;
  font-size: 13px;
}

@media (max-width: 1180px) {
  .admin-metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .admin-filter-grid--draw-guess {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .draw-guess-editor {
    grid-template-columns: 1fr;
  }

  .draw-guess-editor__preview {
    order: 2;
  }

  .draw-guess-editor__form {
    order: 1;
  }

  .draw-guess-editor__stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .admin-metric-grid {
    grid-template-columns: 1fr;
  }

  .admin-filter-grid--draw-guess,
  .draw-guess-editor__grid,
  .draw-guess-editor__stats-grid {
    grid-template-columns: 1fr;
  }

  .admin-filter-actions {
    justify-content: stretch;
  }

  .admin-filter-actions :deep(.el-button) {
    flex: 1;
  }
}
</style>
