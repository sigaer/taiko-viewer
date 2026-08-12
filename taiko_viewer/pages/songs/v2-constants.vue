<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type {
  V2ConstantsDifficulty,
  V2ConstantsItem,
  V2ConstantsPayload,
  V2ConstantsSortKey
} from "~/types/content";
import { buildPageDescription } from "~/utils/seo";

type TableSortChange = {
  prop?: string;
  order?: "ascending" | "descending" | null;
};

const { t } = useI18n();
const apiFetch = useViewerApiFetch();

definePageMeta({
  pageTitleKey: "page.songs.v2Constants.title",
  pageDescKey: "page.songs.v2Constants.desc",
  navKey: "/songs/v2-constants",
  breadcrumbs: [
    { labelKey: "nav.songs", to: "/songs/available" },
    { labelKey: "page.songs.v2Constants.title", to: "/songs/v2-constants" }
  ]
});

useViewerSeo(() => ({
  title: t("page.songs.v2Constants.title"),
  description: buildPageDescription(t("page.songs.v2Constants.desc")),
  path: "/songs/v2-constants",
  keywords: [
    t("page.songs.v2Constants.title"),
    t("page.songs.v2Constants.keyword")
  ],
  breadcrumbs: [
    { name: t("nav.home"), path: "/" },
    { name: t("nav.songs"), path: "/songs/available" },
    { name: t("page.songs.v2Constants.title"), path: "/songs/v2-constants" }
  ]
}));

const keywordInput = ref("");
const keyword = ref("");
const difficulty = ref<"" | V2ConstantsDifficulty>("");
const page = ref(1);
const pageSize = ref(50);
const sortBy = ref<V2ConstantsSortKey>("id");
const sortOrder = ref<"asc" | "desc">("asc");
const fixedColumns = ref(false);
let searchTimer: ReturnType<typeof setTimeout> | null = null;

const syncFixedColumns = () => {
  fixedColumns.value = window.innerWidth > 760;
};

onMounted(() => {
  syncFixedColumns();
  window.addEventListener("resize", syncFixedColumns);
});

watch(keywordInput, (value) => {
  if (searchTimer) {
    clearTimeout(searchTimer);
  }
  searchTimer = setTimeout(() => {
    page.value = 1;
    keyword.value = value.trim();
  }, 300);
});

watch(difficulty, () => {
  page.value = 1;
});

watch(pageSize, () => {
  page.value = 1;
});

onBeforeUnmount(() => {
  if (searchTimer) {
    clearTimeout(searchTimer);
  }
  window.removeEventListener("resize", syncFixedColumns);
});

const { data, pending, error, refresh } = await useAsyncData<V2ConstantsPayload>(
  "v2-constants-table",
  () =>
    apiFetch("/api/content/v2-constants", {
      query: {
        keyword: keyword.value,
        difficulty: difficulty.value,
        page: page.value,
        pageSize: pageSize.value,
        sortBy: sortBy.value,
        sortOrder: sortOrder.value
      }
    }),
  {
    watch: [keyword, difficulty, page, pageSize, sortBy, sortOrder],
    default: () => ({
      total: 0,
      page: 1,
      pageSize: 50,
      generatedAt: "",
      fetchedAt: "",
      stale: false,
      items: []
    })
  }
);

const payload = computed(() => data.value);
const difficultyOptions: V2ConstantsDifficulty[] = ["hard", "oni", "edit"];
const difficultyI18nKey: Record<V2ConstantsDifficulty, string> = {
  hard: "difficulty.3",
  oni: "difficulty.4",
  edit: "difficulty.5"
};

const formatMetric = (value: number) => Number(value).toFixed(2);
const formatGeneratedAt = (value: string) => String(value || "-").replace("T", " ");
const getRowKey = (row: V2ConstantsItem) => `${row.id}-${row.difficulty}`;

const handleSortChange = ({ prop, order }: TableSortChange) => {
  const nextSortBy = prop as V2ConstantsSortKey | undefined;
  if (!nextSortBy || !order) {
    sortBy.value = "id";
    sortOrder.value = "asc";
  } else {
    sortBy.value = nextSortBy;
    sortOrder.value = order === "descending" ? "desc" : "asc";
  }
  page.value = 1;
};
</script>

<template>
  <div class="v2-page">
    <el-card class="panel-card v2-panel">
      <div class="v2-header">
        <div class="v2-heading">
          <div class="v2-title-row">
            <span class="section-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M9 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M17 15V6l-9 2.5v9.5 M5 7.5h14 M5 11h14"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </span>
            <h3>{{ t("page.songs.v2Constants.title") }}</h3>
          </div>
          <p>{{ t("page.songs.v2Constants.panelDesc") }}</p>
          <div class="v2-meta">
            <span>{{ t("page.songs.v2Constants.summary", { total: payload.total }) }}</span>
            <span>
              {{ t("page.songs.v2Constants.generatedAt") }}：
              {{ formatGeneratedAt(payload.generatedAt) }}
            </span>
          </div>
        </div>

        <div class="v2-filters">
          <el-input
            v-model="keywordInput"
            :placeholder="t('page.songs.v2Constants.searchPlaceholder')"
            clearable
          />
          <el-select
            v-model="difficulty"
            :placeholder="t('page.songs.v2Constants.allDifficulties')"
          >
            <el-option
              :label="t('page.songs.v2Constants.allDifficulties')"
              value=""
            />
            <el-option
              v-for="item in difficultyOptions"
              :key="item"
              :label="t(difficultyI18nKey[item])"
              :value="item"
            />
          </el-select>
        </div>
      </div>

      <el-alert
        v-if="payload.stale"
        :title="t('page.songs.v2Constants.stale')"
        type="warning"
        show-icon
        :closable="false"
        class="v2-alert"
      />

      <div v-if="error" class="v2-error">
        <el-empty :description="t('page.songs.v2Constants.loadFailed')">
          <el-button type="primary" @click="refresh()">{{ t("common.retry") }}</el-button>
        </el-empty>
      </div>

      <div
        v-else
        class="v2-table-wrap"
        :style="{
          minHeight: `${Math.max(360, payload.items.length * 42 + 96)}px`,
          '--v2-body-height': `${Math.max(264, payload.items.length * 42)}px`
        }"
      >
        <el-table
          v-loading="pending"
          :data="payload.items"
          stripe
          :row-key="getRowKey"
          :default-sort="{ prop: 'id', order: 'ascending' }"
          :empty-text="t('page.songs.v2Constants.empty')"
          @sort-change="handleSortChange"
        >
          <el-table-column
            prop="id"
            :label="t('page.songs.v2Constants.columns.id')"
            width="86"
            :fixed="fixedColumns ? 'left' : false"
            sortable="custom"
          />
          <el-table-column
            prop="songName"
            :label="t('page.songs.v2Constants.columns.songName')"
            min-width="220"
            :fixed="fixedColumns ? 'left' : false"
            sortable="custom"
          />
          <el-table-column
            prop="difficulty"
            :label="t('page.songs.v2Constants.columns.difficulty')"
            width="96"
            sortable="custom"
          >
            <template #default="{ row }">
              <span class="difficulty-tag" :class="`difficulty-tag--${row.difficulty}`">
                {{ t(difficultyI18nKey[row.difficulty as V2ConstantsDifficulty]) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column
            prop="totalNotes"
            :label="t('page.songs.v2Constants.columns.totalNotes')"
            width="96"
            align="right"
            sortable="custom"
          />
          <el-table-column :label="t('page.songs.v2Constants.groups.constants')" align="center">
            <el-table-column
              prop="subConstant1"
              :label="t('page.songs.v2Constants.columns.subConstant1')"
              width="112"
              align="right"
              sortable="custom"
            >
              <template #default="{ row }">{{ formatMetric(row.subConstant1) }}</template>
            </el-table-column>
            <el-table-column
              prop="mainConstant"
              :label="t('page.songs.v2Constants.columns.mainConstant')"
              width="106"
              align="right"
              sortable="custom"
            >
              <template #default="{ row }">{{ formatMetric(row.mainConstant) }}</template>
            </el-table-column>
            <el-table-column
              prop="subConstant2"
              :label="t('page.songs.v2Constants.columns.subConstant2')"
              width="112"
              align="right"
              sortable="custom"
            >
              <template #default="{ row }">{{ formatMetric(row.subConstant2) }}</template>
            </el-table-column>
          </el-table-column>
          <el-table-column :label="t('page.songs.v2Constants.groups.dimensions')" align="center">
            <el-table-column
              v-for="column in ([
                'stamina',
                'handspeed',
                'burst',
                'complex',
                'rhythm'
              ] as V2ConstantsSortKey[])"
              :key="column"
              :prop="column"
              :label="t(`page.songs.v2Constants.columns.${column}`)"
              width="88"
              align="right"
              sortable="custom"
            >
              <template #default="{ row }">{{ formatMetric(row[column]) }}</template>
            </el-table-column>
          </el-table-column>
        </el-table>
      </div>

      <div v-if="!error && payload.total > 0" class="v2-pagination">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :page-sizes="[25, 50, 100]"
          :total="payload.total"
          layout="total, sizes, prev, pager, next, jumper"
          background
        />
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.v2-page {
  display: grid;
  gap: 20px;
}

.v2-panel {
  overflow: hidden;
}

.v2-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 18px;
}

.v2-heading {
  min-width: 0;
}

.v2-title-row {
  display: flex;
  align-items: center;
  gap: 9px;
}

.v2-title-row h3 {
  margin: 0;
  color: #4f3e31;
  font-size: 20px;
}

.section-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 30px;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  color: #b66c3d;
  background: #fff0e4;
}

.section-icon svg {
  width: 19px;
  height: 19px;
}

.v2-heading p {
  margin: 8px 0 0;
  color: #796858;
  line-height: 1.6;
}

.v2-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  margin-top: 8px;
  color: #9a7254;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.v2-filters {
  display: grid;
  grid-template-columns: minmax(220px, 320px) 150px;
  gap: 10px;
  flex: 0 1 490px;
}

.v2-alert {
  margin-bottom: 14px;
}

.v2-table-wrap {
  width: 100%;
  overflow-x: auto;
}

.v2-table-wrap :deep(.el-table) {
  font-variant-numeric: tabular-nums;
}

.v2-table-wrap :deep(.el-table__body-wrapper) {
  min-height: var(--v2-body-height);
}

.difficulty-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 48px;
  padding: 3px 9px;
  border: 1px solid transparent;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.difficulty-tag--hard {
  color: #257547;
  background: #e8f6ed;
  border-color: #b9e3c8;
}

.difficulty-tag--oni {
  color: #a63868;
  background: #fceaf2;
  border-color: #f2bfd4;
}

.difficulty-tag--edit {
  color: #6d3c97;
  background: #f2eafd;
  border-color: #d9c2f0;
}

.v2-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 18px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.v2-error {
  padding: 18px 0;
}

:global(body.theme-dark) .v2-title-row h3 {
  color: #f2e4d7;
}

:global(body.theme-dark) .v2-heading p,
:global(body.theme-dark) .v2-meta {
  color: #c7ad98;
}

@media (max-width: 760px) {
  .v2-header {
    align-items: stretch;
    flex-direction: column;
    gap: 16px;
  }

  .v2-filters {
    grid-template-columns: 1fr;
    flex-basis: auto;
  }

  .v2-pagination {
    justify-content: flex-start;
  }
}
</style>
