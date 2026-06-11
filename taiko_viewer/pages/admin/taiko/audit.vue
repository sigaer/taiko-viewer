<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { formatAdminDateTime } from "~/utils/admin-time";

defineI18nRoute(false);

definePageMeta({
  layout: "admin-taiko",
  middleware: "admin-auth"
});

useHead({
  title: "审计日志"
});

type AuditPayload = {
  total: number;
  page: number;
  pageSize: number;
  items: Array<Record<string, any>>;
};

const apiFetch = useAdminApiFetch();
const detailDialogVisible = ref(false);
const selectedRow = ref<Record<string, any> | null>(null);
const filters = reactive({
  keyword: "",
  source: "",
  action: "",
  targetType: "",
  page: 1,
  pageSize: 20
});

const { data, refresh } = await useAsyncData<AuditPayload>(
  "admin-audit-list",
  () =>
    apiFetch("/api/admin/audit", {
      query: filters
    }),
  {
    default: () => ({ total: 0, page: 1, pageSize: 20, items: [] })
  }
);

const prettyDetail = computed(() =>
  selectedRow.value
    ? {
        before: JSON.stringify(selectedRow.value.before, null, 2),
        after: JSON.stringify(selectedRow.value.after, null, 2),
        extra: JSON.stringify(selectedRow.value.extra, null, 2)
      }
    : {
        before: "",
        after: "",
        extra: ""
      }
);

const openDetail = (row: Record<string, any>) => {
  selectedRow.value = row;
  detailDialogVisible.value = true;
};
</script>

<template>
  <div class="admin-page-stack">
    <el-card class="admin-panel-card">
      <div class="admin-filter-grid">
        <el-input v-model="filters.keyword" placeholder="按 target / actor / source 检索" clearable @keyup.enter="refresh()" />
        <el-select v-model="filters.source" clearable placeholder="来源">
          <el-option label="admin-web" value="admin-web" />
          <el-option label="bot-tset" value="bot-tset" />
          <el-option label="bot-cover" value="bot-cover" />
          <el-option label="system-backup" value="system-backup" />
        </el-select>
        <el-select v-model="filters.action" clearable placeholder="动作">
          <el-option label="read" value="read" />
          <el-option label="create" value="create" />
          <el-option label="update" value="update" />
          <el-option label="delete" value="delete" />
          <el-option label="login" value="login" />
        </el-select>
        <el-input v-model="filters.targetType" placeholder="targetType" />
        <div class="admin-filter-actions">
          <el-button @click="refresh()">筛选</el-button>
        </div>
      </div>
    </el-card>

    <el-card class="admin-panel-card">
      <el-table :data="data.items" stripe>
        <el-table-column label="时间" width="180">
          <template #default="{ row }">
            <span>{{ formatAdminDateTime(row.createdAt) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="source" label="来源" width="120" />
        <el-table-column prop="action" label="动作" width="92" />
        <el-table-column prop="targetType" label="目标类型" width="140" />
        <el-table-column prop="targetKey" label="目标键" min-width="220" />
        <el-table-column label="操作者" min-width="160">
          <template #default="{ row }">
            <div class="admin-title-pair">
              <strong>{{ row.actorName || row.actorId || row.actorType }}</strong>
              <span>{{ row.actorType }} · {{ row.actorId || "-" }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="详情" width="96" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">查看</el-button>
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

    <el-dialog v-model="detailDialogVisible" title="审计详情" width="960px">
      <div v-if="selectedRow" class="audit-detail-grid">
        <div class="audit-detail-meta">
          <strong>{{ selectedRow.action.toUpperCase() }} · {{ selectedRow.targetType }}</strong>
          <span>{{ selectedRow.source }} · {{ formatAdminDateTime(selectedRow.createdAt) }}</span>
          <span>{{ selectedRow.targetKey }}</span>
        </div>
        <div class="audit-detail-panels">
          <section>
            <h3>Before</h3>
            <pre>{{ prettyDetail.before }}</pre>
          </section>
          <section>
            <h3>After</h3>
            <pre>{{ prettyDetail.after }}</pre>
          </section>
          <section class="full">
            <h3>Extra</h3>
            <pre>{{ prettyDetail.extra }}</pre>
          </section>
        </div>
      </div>
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
  grid-template-columns: 1.6fr 160px 160px 1fr auto;
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

.admin-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 18px;
}

.audit-detail-grid {
  display: grid;
  gap: 18px;
}

.audit-detail-meta {
  display: grid;
  gap: 6px;
}

.audit-detail-panels {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.audit-detail-panels section {
  min-width: 0;
}

.audit-detail-panels section.full {
  grid-column: 1 / -1;
}

.audit-detail-panels h3 {
  margin: 0 0 8px;
}

.audit-detail-panels pre {
  margin: 0;
  padding: 14px;
  min-height: 180px;
  border-radius: 16px;
  background: #0f172a;
  color: #f8fafc;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 980px) {
  .admin-filter-grid,
  .audit-detail-panels {
    grid-template-columns: 1fr;
  }

  .admin-filter-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }
}
</style>
