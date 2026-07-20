<script setup lang="ts">
import { reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { formatAdminDateTime } from "~/utils/admin-time";

defineI18nRoute(false);
definePageMeta({ layout: "admin-taiko", middleware: "admin-auth" });
useHead({ title: "自定义称号" });

type CustomTitleItem = {
  id: number;
  titleName: string;
  songId: number;
  difficultyLevel: number;
  difficultyLabel: string;
  achievementType: "clear" | "full_combo" | "all_perfect";
  achievementLabel: string;
  plateStyle: "silver" | "gold" | "rainbow";
  creatorName: string;
  creatorId: string;
  source: string;
  groupName: string;
  createdAt: string;
  updatedAt: string;
  officialConflict: boolean;
  song: null | { id: number; songName: string; songNameJp: string; chartLevel: string };
};

type ListPayload = { total: number; page: number; pageSize: number; items: CustomTitleItem[] };
type SongOption = { id: number; song_name?: string; song_name_jp?: string };

const apiFetch = useAdminApiFetch();
const loading = ref(false);
const dialogVisible = ref(false);
const editingId = ref<number | null>(null);
const songLoading = ref(false);
const songOptions = ref<SongOption[]>([]);
const filters = reactive({ keyword: "", level: "", achievement: "", page: 1, pageSize: 20 });
const form = reactive({ titleName: "", songId: "", level: 4, achievement: "full_combo" });
const levelOptions = [
  { value: 5, label: "里谱 · level 5" },
  { value: 4, label: "表谱 · level 4" },
  { value: 3, label: "松谱 · level 3" },
  { value: 2, label: "竹谱 · level 2" },
  { value: 1, label: "梅谱 · level 1" }
];
const plateLegend = [
  { key: "clear", style: "silver", label: "过关", src: "/assets/my-don/custom-title/name_plate_custom_sliver.png" },
  { key: "full_combo", style: "gold", label: "全连", src: "/assets/my-don/custom-title/name_plate_custom_gold.png" },
  { key: "all_perfect", style: "rainbow", label: "全良", src: "/assets/my-don/custom-title/name_plate_custom_rainbow.png" }
];
const achievementOptions = plateLegend.map(({ key, label }) => ({ value: key, label }));

const { data, refresh } = await useAsyncData<ListPayload>(
  "admin-custom-title-list",
  () => apiFetch("/api/admin/custom-titles", { query: filters }),
  { default: () => ({ total: 0, page: 1, pageSize: 20, items: [] }) }
);

const searchSongs = async (keyword: string) => {
  songLoading.value = true;
  try {
    const payload = await apiFetch<{ items: SongOption[] }>("/api/admin/songs", {
      query: { keyword, page: 1, pageSize: 50 }
    });
    songOptions.value = payload.items || [];
  } finally {
    songLoading.value = false;
  }
};

const openCreate = async () => {
  editingId.value = null;
  Object.assign(form, { titleName: "", songId: "", level: 4, achievement: "full_combo" });
  dialogVisible.value = true;
  await searchSongs("");
};

const openUpdate = async (item: CustomTitleItem) => {
  editingId.value = item.id;
  Object.assign(form, {
    titleName: item.titleName,
    songId: String(item.songId),
    level: item.difficultyLevel,
    achievement: item.achievementType
  });
  songOptions.value = item.song
    ? [{ id: item.song.id, song_name: item.song.songName, song_name_jp: item.song.songNameJp }]
    : [{ id: item.songId }];
  dialogVisible.value = true;
};

const saveTitle = async () => {
  if (!form.titleName.trim() || !form.songId) {
    ElMessage.warning("请填写称号名并选择歌曲");
    return;
  }
  loading.value = true;
  try {
    const isUpdate = editingId.value !== null;
    await apiFetch(`/api/admin/custom-titles/${isUpdate ? "update" : "create"}`, {
      method: "POST",
      body: {
        ...(isUpdate ? { id: editingId.value } : {}),
        titleName: form.titleName,
        songId: Number(form.songId),
        level: form.level,
        achievement: form.achievement
      }
    });
    ElMessage.success(isUpdate ? "称号已更新" : "称号已创建");
    dialogVisible.value = false;
    await refresh();
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || "保存失败");
  } finally {
    loading.value = false;
  }
};

const deleteTitle = async (item: CustomTitleItem) => {
  try {
    await ElMessageBox.confirm(
      `删除“${item.titleName}”后，它也会从所有用户手选槽位中移除。`,
      "删除自定义称号",
      { type: "warning", confirmButtonText: "删除", cancelButtonText: "取消" }
    );
    await apiFetch("/api/admin/custom-titles/delete", { method: "POST", body: { id: item.id } });
    ElMessage.success("称号已删除");
    await refresh();
  } catch (error: any) {
    if (error === "cancel") return;
    ElMessage.error(error?.data?.statusMessage || error?.message || "删除失败");
  }
};

const sourceLabel = (source: string) => source === "bot-custom-title" ? "用户指令" : "后台创建";
</script>

<template>
  <div class="custom-title-page">
    <el-card class="admin-panel-card title-workshop">
      <div class="workshop-copy">
        <span class="workshop-eyebrow">TITLE WORKSHOP</span>
        <h2>自定义称号</h2>
        <p>每个称号绑定一个谱面和固定成就。达到更高成绩仍使用创建时选择的材质，不会自动升级。</p>
      </div>
      <div class="plate-legend" aria-label="称号成绩样式">
        <figure v-for="plate in plateLegend" :key="plate.key">
          <img :src="plate.src" alt="" />
          <figcaption>{{ plate.label }}</figcaption>
        </figure>
      </div>
    </el-card>

    <el-card class="admin-panel-card">
      <div class="admin-filter-grid">
        <el-input
          v-model="filters.keyword"
          placeholder="按称号、歌曲、ID、提交者检索"
          clearable
          @keyup.enter="filters.page = 1; refresh()"
        />
        <el-select v-model="filters.level" clearable placeholder="全部难度">
          <el-option v-for="item in levelOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-select v-model="filters.achievement" clearable placeholder="全部成就">
          <el-option v-for="item in achievementOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <div class="admin-filter-actions">
          <el-button @click="filters.page = 1; refresh()">筛选</el-button>
          <el-button type="primary" @click="openCreate">新增称号</el-button>
        </div>
      </div>
    </el-card>

    <el-card class="admin-panel-card">
      <el-table :data="data.items" stripe>
        <el-table-column prop="id" label="ID" width="76" />
        <el-table-column label="称号" min-width="190">
          <template #default="{ row }">
            <div class="admin-title-pair">
              <strong>{{ row.titleName }}</strong>
              <el-tag v-if="row.officialConflict" type="danger" size="small">与既有称号冲突</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="目标谱面" min-width="250">
          <template #default="{ row }">
            <div class="admin-title-pair">
              <strong>{{ row.song?.songNameJp || row.song?.songName || `#${row.songId}` }}</strong>
              <span>id{{ row.songId }} · {{ row.difficultyLabel }}谱 · {{ row.song?.chartLevel || "-" }}★</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="来源" min-width="180">
          <template #default="{ row }">
            <div class="admin-title-pair">
              <strong>{{ row.creatorName || row.creatorId }}</strong>
              <span>{{ sourceLabel(row.source) }}<template v-if="row.groupName"> · {{ row.groupName }}</template></span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="固定成就" width="108">
          <template #default="{ row }">
            <el-tag :type="row.plateStyle === 'rainbow' ? 'danger' : row.plateStyle === 'gold' ? 'warning' : 'info'">
              {{ row.achievementLabel }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" width="178">
          <template #default="{ row }">{{ formatAdminDateTime(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="132" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openUpdate(row)">编辑</el-button>
            <el-button link type="danger" @click="deleteTitle(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!data.items.length" description="还没有自定义称号，可从 bot 指令或后台新增。" />
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

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑自定义称号' : '新增自定义称号'" width="560px">
      <el-form label-position="top">
        <el-form-item label="称号名">
          <el-input v-model="form.titleName" maxlength="30" show-word-limit placeholder="1–30 个字符，不得与既有称号重名" />
        </el-form-item>
        <el-form-item label="歌曲">
          <el-select
            v-model="form.songId"
            filterable
            remote
            reserve-keyword
            :remote-method="searchSongs"
            :loading="songLoading"
            placeholder="输入歌曲名或 ID 搜索"
            style="width: 100%"
          >
            <el-option
              v-for="song in songOptions"
              :key="song.id"
              :label="`${song.song_name_jp || song.song_name || `#${song.id}`} · id${song.id}`"
              :value="String(song.id)"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="难度">
          <el-select v-model="form.level" style="width: 100%">
            <el-option v-for="item in levelOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="成就与固定材质">
          <el-select v-model="form.achievement" style="width: 100%">
            <el-option v-for="item in achievementOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
          <span class="form-hint">过关为银色、全连为金色、全良为彩虹；创建后不会按更高成绩自动换材质。</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="loading" @click="saveTitle">保存称号</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.custom-title-page { display: grid; gap: 20px; }
.admin-panel-card { border: none; border-radius: 24px; }
.title-workshop :deep(.el-card__body) {
  display: grid;
  grid-template-columns: minmax(260px, 0.9fr) minmax(420px, 1.1fr);
  gap: 28px;
  align-items: center;
  background: linear-gradient(125deg, #fffdf8 0%, #f7f1e4 58%, #eef2f7 100%);
}
.workshop-copy { max-width: 560px; }
.workshop-eyebrow { color: #9a6b23; font-size: 11px; font-weight: 800; letter-spacing: 0.18em; }
.workshop-copy h2 { margin: 7px 0 8px; color: #2f281e; font-size: 28px; }
.workshop-copy p { margin: 0; color: #726756; line-height: 1.75; }
.plate-legend { display: grid; gap: 8px; }
.plate-legend figure { position: relative; margin: 0; min-width: 0; }
.plate-legend img { display: block; width: 100%; height: auto; }
.plate-legend figcaption {
  position: absolute;
  right: 18px;
  bottom: 8px;
  color: #453b2f;
  font-size: 12px;
  font-weight: 800;
}
.admin-filter-grid { display: grid; grid-template-columns: minmax(240px, 1fr) 180px 150px auto; gap: 12px; }
.admin-filter-actions { display: flex; justify-content: flex-end; gap: 10px; }
.admin-title-pair { display: grid; gap: 4px; }
.admin-title-pair span { color: #7c6f5f; font-size: 12px; }
.form-hint { display: block; margin-top: 7px; color: #8a7d6c; font-size: 12px; line-height: 1.6; }
.admin-pagination { display: flex; justify-content: flex-end; margin-top: 18px; }
@media (max-width: 900px) {
  .title-workshop :deep(.el-card__body), .admin-filter-grid { grid-template-columns: 1fr; }
  .admin-filter-actions { justify-content: flex-start; }
}
</style>
