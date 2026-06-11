<script setup lang="ts">
import { reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";

defineI18nRoute(false);

definePageMeta({
  layout: "admin-taiko",
  middleware: "admin-auth"
});

useHead({
  title: "封面管理"
});

type CoverListPayload = {
  total: number;
  page: number;
  pageSize: number;
  items: Array<{
    songId: number;
    title: string;
    titleJp: string;
    type: string;
    hasCover: boolean;
    coverUrl: string;
  }>;
};

const apiFetch = useAdminApiFetch();
const loading = ref(false);
const showUploadDialog = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const selectedFile = ref<File | null>(null);
const filters = reactive({
  keyword: "",
  hasCover: "",
  page: 1,
  pageSize: 20
});
const uploadForm = reactive({
  songId: "",
  replace: true
});

const { data, refresh } = await useAsyncData<CoverListPayload>(
  "admin-cover-list",
  () =>
    apiFetch("/api/admin/covers", {
      query: filters
    }),
  {
    default: () => ({ total: 0, page: 1, pageSize: 20, items: [] })
  }
);

const openUploadDialog = (row?: CoverListPayload["items"][number]) => {
  Object.assign(uploadForm, {
    songId: row?.songId ? String(row.songId) : "",
    replace: row?.hasCover ?? true
  });
  selectedFile.value = null;
  if (fileInput.value) fileInput.value.value = "";
  showUploadDialog.value = true;
};

const pickFile = () => {
  fileInput.value?.click();
};

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  selectedFile.value = target.files?.[0] || null;
};

const submitUpload = async () => {
  if (!selectedFile.value) {
    ElMessage.warning("请先选择图片文件");
    return;
  }
  loading.value = true;
  try {
    const body = new FormData();
    body.append("songId", uploadForm.songId);
    body.append("replace", uploadForm.replace ? "1" : "0");
    body.append("file", selectedFile.value);
    await apiFetch("/api/admin/covers/upload", {
      method: "POST",
      body
    });
    ElMessage.success("封面已上传");
    showUploadDialog.value = false;
    await refresh();
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || "上传失败");
  } finally {
    loading.value = false;
  }
};

const removeCover = async (row: CoverListPayload["items"][number]) => {
  try {
    await ElMessageBox.confirm(`确定删除歌曲 ${row.title} 的封面吗？`, "删除确认", { type: "warning" });
    await apiFetch("/api/admin/covers/delete", {
      method: "POST",
      body: {
        songId: row.songId
      }
    });
    ElMessage.success("封面已删除");
    await refresh();
  } catch (error: any) {
    if (error === "cancel") return;
    ElMessage.error(error?.data?.statusMessage || error?.message || "删除失败");
  }
};
</script>

<template>
  <div class="admin-page-stack">
    <el-card class="admin-panel-card">
      <div class="admin-filter-grid">
        <el-input v-model="filters.keyword" placeholder="按歌曲名 / ID 检索" clearable @keyup.enter="refresh()" />
        <el-select v-model="filters.hasCover" clearable placeholder="封面状态">
          <el-option label="已有封面" value="1" />
          <el-option label="缺失封面" value="0" />
        </el-select>
        <div class="admin-filter-actions">
          <el-button @click="refresh()">筛选</el-button>
          <el-button type="primary" @click="openUploadDialog()">上传封面</el-button>
        </div>
      </div>
    </el-card>

    <el-card class="admin-panel-card">
      <el-table :data="data.items" stripe>
        <el-table-column prop="songId" label="歌曲 ID" width="100" />
        <el-table-column label="封面" width="120">
          <template #default="{ row }">
            <div class="cover-thumb">
              <img v-if="row.hasCover" :src="row.coverUrl" :alt="row.title" />
              <span v-else>缺失</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="曲名" min-width="220" />
        <el-table-column prop="titleJp" label="日文名" min-width="220" />
        <el-table-column prop="type" label="分类" width="140" />
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="row.hasCover ? 'success' : 'warning'">{{ row.hasCover ? "已上传" : "待补全" }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <div class="admin-table-actions">
              <el-button link type="primary" @click="openUploadDialog(row)">{{ row.hasCover ? "替换" : "上传" }}</el-button>
              <el-button v-if="row.hasCover" link type="danger" @click="removeCover(row)">删除</el-button>
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

    <el-dialog v-model="showUploadDialog" title="上传 / 替换封面" width="520px">
      <el-form label-position="top">
        <el-form-item label="歌曲 ID">
          <el-input v-model="uploadForm.songId" />
        </el-form-item>
        <el-form-item label="允许替换">
          <el-switch v-model="uploadForm.replace" />
        </el-form-item>
        <el-form-item label="封面文件">
          <input ref="fileInput" class="hidden-file-input" type="file" accept="image/*" @change="handleFileChange" />
          <div class="file-picker-row">
            <el-button @click="pickFile">选择图片</el-button>
            <span>{{ selectedFile?.name || "未选择文件" }}</span>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showUploadDialog = false">取消</el-button>
        <el-button type="primary" :loading="loading" @click="submitUpload">上传</el-button>
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
  grid-template-columns: 1fr 180px auto;
  gap: 12px;
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

.cover-thumb {
  width: 78px;
  height: 78px;
  border-radius: 16px;
  background: rgba(243, 235, 219, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.cover-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hidden-file-input {
  display: none;
}

.file-picker-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.admin-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 18px;
}

@media (max-width: 880px) {
  .admin-filter-grid {
    grid-template-columns: 1fr;
  }

  .admin-filter-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }
}
</style>
