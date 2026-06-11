<script setup lang="ts">
import { reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";

defineI18nRoute(false);

definePageMeta({
  layout: "admin-taiko",
  middleware: "admin-auth"
});

useHead({
  title: "别名管理"
});

type AliasListPayload = {
  total: number;
  page: number;
  pageSize: number;
  items: Array<Record<string, any>>;
};

type LegacyAliasLogPayload = {
  total: number;
  page: number;
  pageSize: number;
  items: Array<Record<string, any>>;
};

const apiFetch = useAdminApiFetch();
const loading = ref(false);
const showCreateDialog = ref(false);
const showUpdateDialog = ref(false);
const filters = reactive({
  keyword: "",
  page: 1,
  pageSize: 20
});

const createForm = reactive({
  songId: "",
  alias: ""
});

const updateForm = reactive({
  songId: "",
  oldAlias: "",
  newAlias: ""
});

const { data, refresh } = await useAsyncData<AliasListPayload>(
  "admin-alias-list",
  () =>
    apiFetch("/api/admin/aliases", {
      query: filters
    }),
  {
    default: () => ({ total: 0, page: 1, pageSize: 20, items: [] })
  }
);

const { data: legacyLogs, refresh: refreshLegacyLogs } = await useAsyncData<LegacyAliasLogPayload>(
  "admin-alias-legacy-log",
  () =>
    apiFetch("/api/admin/aliases/legacy-log", {
      query: {
        page: 1,
        pageSize: 10
      }
    }),
  {
    default: () => ({ total: 0, page: 1, pageSize: 10, items: [] })
  }
);

const openCreateDialog = () => {
  Object.assign(createForm, {
    songId: "",
    alias: ""
  });
  showCreateDialog.value = true;
};

const openUpdateDialog = (row: Record<string, any>, alias: string) => {
  Object.assign(updateForm, {
    songId: row.id,
    oldAlias: alias,
    newAlias: alias
  });
  showUpdateDialog.value = true;
};

const submitCreate = async () => {
  loading.value = true;
  try {
    await apiFetch("/api/admin/aliases/create", {
      method: "POST",
      body: createForm
    });
    ElMessage.success("别名已添加");
    showCreateDialog.value = false;
    await Promise.all([refresh(), refreshLegacyLogs()]);
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || "添加失败");
  } finally {
    loading.value = false;
  }
};

const submitUpdate = async () => {
  loading.value = true;
  try {
    await apiFetch("/api/admin/aliases/update", {
      method: "POST",
      body: updateForm
    });
    ElMessage.success("别名已更新");
    showUpdateDialog.value = false;
    await refresh();
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || "更新失败");
  } finally {
    loading.value = false;
  }
};

const removeAlias = async (songId: number, alias: string) => {
  try {
    await ElMessageBox.confirm(`确定删除别名“${alias}”吗？`, "删除确认", { type: "warning" });
    await apiFetch("/api/admin/aliases/delete", {
      method: "POST",
      body: {
        songId,
        alias
      }
    });
    ElMessage.success("别名已删除");
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
        <el-input v-model="filters.keyword" placeholder="按歌曲名 / ID / 别名检索" clearable @keyup.enter="refresh()" />
        <div class="admin-filter-actions">
          <el-button @click="refresh()">筛选</el-button>
          <el-button type="primary" @click="openCreateDialog">新增别名</el-button>
        </div>
      </div>
    </el-card>

    <el-card class="admin-panel-card">
      <el-table :data="data.items" stripe>
        <el-table-column prop="id" label="歌曲 ID" width="100" />
        <el-table-column label="歌曲" min-width="220">
          <template #default="{ row }">
            <div class="admin-title-pair">
              <strong>{{ row.song?.song_name || `#${row.id}` }}</strong>
              <span>{{ row.song?.song_name_jp || row.song_name_jp || "" }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="别名列表" min-width="420">
          <template #default="{ row }">
            <div class="admin-tag-row">
              <el-tag
                v-for="alias in row.aliases"
                :key="`${row.id}-${alias}`"
                closable
                @close.prevent="removeAlias(row.id, alias)"
              >
                <span class="alias-tag__text">{{ alias }}</span>
                <button type="button" class="alias-tag__edit" @click.stop="openUpdateDialog(row, alias)">改</button>
              </el-tag>
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

    <el-card class="admin-panel-card">
      <template #header>
        <div class="admin-panel-card__header">
          <span>历史 bot 别名来源</span>
          <small>兼容读取 logs/alias_action_log.json</small>
        </div>
      </template>
      <el-table :data="legacyLogs.items" size="small">
        <el-table-column prop="time" label="时间" width="180" />
        <el-table-column prop="song_id" label="歌曲 ID" width="100" />
        <el-table-column prop="song_title" label="歌曲名" min-width="180" />
        <el-table-column prop="alias" label="别名" min-width="140" />
        <el-table-column prop="user_nickname" label="来源用户" min-width="120" />
        <el-table-column prop="group_name" label="群来源" min-width="160" />
      </el-table>
    </el-card>

    <el-dialog v-model="showCreateDialog" title="新增别名" width="520px">
      <el-form label-position="top">
        <el-form-item label="歌曲 ID">
          <el-input v-model="createForm.songId" />
        </el-form-item>
        <el-form-item label="别名">
          <el-input v-model="createForm.alias" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" :loading="loading" @click="submitCreate">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showUpdateDialog" title="修改别名" width="520px">
      <el-form label-position="top">
        <el-form-item label="歌曲 ID">
          <el-input v-model="updateForm.songId" disabled />
        </el-form-item>
        <el-form-item label="旧别名">
          <el-input v-model="updateForm.oldAlias" disabled />
        </el-form-item>
        <el-form-item label="新别名">
          <el-input v-model="updateForm.newAlias" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showUpdateDialog = false">取消</el-button>
        <el-button type="primary" :loading="loading" @click="submitUpdate">保存</el-button>
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

.admin-panel-card__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.admin-filter-grid {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
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

.admin-title-pair span {
  color: #7c6f5f;
  font-size: 12px;
}

.admin-tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.alias-tag__text {
  margin-right: 6px;
}

.alias-tag__edit {
  border: none;
  background: transparent;
  color: #7a5e2d;
  cursor: pointer;
  font-size: 12px;
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
