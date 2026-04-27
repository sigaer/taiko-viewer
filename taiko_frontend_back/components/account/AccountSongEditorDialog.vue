<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import type { SongCatalogItem } from "~/types/content";

type SongEditorMode = "edit" | "create";

type SongEditorRow = {
  songNo: number;
  level: number;
  title: string;
  titleJp: string;
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
};

type CatalogSuggestion = {
  value: string;
  song: SongCatalogItem;
};

const props = defineProps<{
  modelValue: boolean;
  mode: SongEditorMode;
  songCatalog: SongCatalogItem[];
  initialSong?: SongEditorRow | null;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  saved: [];
}>();

const DEFAULT_LEVEL_OPTIONS = [
  { value: 1, label: "简单" },
  { value: 2, label: "一般" },
  { value: 3, label: "困难" },
  { value: 4, label: "魔王" },
  { value: 5, label: "里谱" }
] as const;

const saving = ref(false);
const catalogKeyword = ref("");
const form = reactive({
  sourceType: "catalog" as "catalog" | "custom",
  catalogSongNo: 0,
  songNo: 0,
  level: 4,
  title: "",
  titleJp: "",
  high_score: 0,
  best_score_rank: 0,
  good_cnt: 0,
  ok_cnt: 0,
  ng_cnt: 0,
  pound_cnt: 0,
  stage_cnt: 0,
  clear_cnt: 0,
  full_combo_cnt: 0,
  dondaful_combo_cnt: 0,
  combo_cnt: 0
});

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit("update:modelValue", value)
});

const isCreateMode = computed(() => props.mode === "create");
const isCustomMode = computed(() => isCreateMode.value && form.sourceType === "custom");
const selectedCatalogSong = computed(() =>
  props.songCatalog.find((item) => Number(item.id) === Number(form.catalogSongNo)) || null
);

const dialogTitle = computed(() => (isCreateMode.value ? "新增谱面记录" : "编辑谱面记录"));

const buildCatalogLabel = (song: SongCatalogItem) => {
  const status = Number(song.shelf_status || 0) === 1 ? "已下架" : "现有";
  const jp = song.song_name_jp ? ` / ${song.song_name_jp}` : "";
  return `${song.song_name}${jp} · ID ${song.id} · ${status}`;
};

const availableLevelOptions = computed(() => {
  if (!isCreateMode.value || isCustomMode.value) {
    return DEFAULT_LEVEL_OPTIONS.map((item) => ({ ...item }));
  }
  const song = selectedCatalogSong.value;
  if (!song) {
    return DEFAULT_LEVEL_OPTIONS.map((item) => ({ ...item }));
  }
  const options = DEFAULT_LEVEL_OPTIONS.filter((item) => {
    const levelValue = song[`level_${item.value}` as keyof SongCatalogItem];
    return levelValue !== undefined && levelValue !== null && String(levelValue).trim() !== "";
  }).map((item) => {
    const starLevel = song[`level_${item.value}` as keyof SongCatalogItem];
    const starText = starLevel === undefined || starLevel === null || String(starLevel).trim() === "" ? "" : ` ★${starLevel}`;
    return {
      value: item.value,
      label: `${item.label}${starText}`
    };
  });
  return options.length ? options : DEFAULT_LEVEL_OPTIONS.map((item) => ({ ...item }));
});

const syncLevelSelection = () => {
  if (availableLevelOptions.value.some((item) => item.value === form.level)) return;
  form.level = availableLevelOptions.value[0]?.value || 4;
};

const resetForm = () => {
  form.sourceType = "catalog";
  form.catalogSongNo = 0;
  form.songNo = 0;
  form.level = 4;
  form.title = "";
  form.titleJp = "";
  form.high_score = 0;
  form.best_score_rank = 0;
  form.good_cnt = 0;
  form.ok_cnt = 0;
  form.ng_cnt = 0;
  form.pound_cnt = 0;
  form.stage_cnt = 0;
  form.clear_cnt = 0;
  form.full_combo_cnt = 0;
  form.dondaful_combo_cnt = 0;
  form.combo_cnt = 0;
  catalogKeyword.value = "";

  if (props.mode === "edit" && props.initialSong) {
    form.songNo = props.initialSong.songNo;
    form.level = props.initialSong.level;
    form.title = props.initialSong.title;
    form.titleJp = props.initialSong.titleJp;
    form.high_score = props.initialSong.highScore;
    form.best_score_rank = props.initialSong.bestScoreRank;
    form.good_cnt = props.initialSong.goodCnt;
    form.ok_cnt = props.initialSong.okCnt;
    form.ng_cnt = props.initialSong.ngCnt;
    form.pound_cnt = props.initialSong.poundCnt;
    form.stage_cnt = props.initialSong.stageCnt;
    form.clear_cnt = props.initialSong.clearCnt;
    form.full_combo_cnt = props.initialSong.fullComboCnt;
    form.dondaful_combo_cnt = props.initialSong.dondafulComboCnt;
    form.combo_cnt = props.initialSong.comboCnt;
  }
};

watch(
  () => [props.modelValue, props.mode, props.initialSong?.songNo, props.initialSong?.level],
  () => {
    if (props.modelValue) {
      resetForm();
    }
  },
  { immediate: true }
);

watch(
  () => form.catalogSongNo,
  () => {
    if (!isCreateMode.value || isCustomMode.value) return;
    const song = selectedCatalogSong.value;
    if (!song) return;
    catalogKeyword.value = buildCatalogLabel(song);
    syncLevelSelection();
  }
);

watch(
  () => [form.sourceType, availableLevelOptions.value.map((item) => item.value).join(",")],
  () => {
    if (!props.modelValue || !isCreateMode.value) return;
    syncLevelSelection();
  }
);

const queryCatalogSongs = (queryString: string, callback: (items: CatalogSuggestion[]) => void) => {
  const keyword = queryString.trim().toLowerCase();
  const options = props.songCatalog
    .filter((song) => {
      if (!keyword) return true;
      return (
        String(song.id).includes(keyword) ||
        String(song.song_name || "").toLowerCase().includes(keyword) ||
        String(song.song_name_jp || "").toLowerCase().includes(keyword)
      );
    })
    .sort((left, right) => {
      const leftStatus = Number(left.shelf_status || 0);
      const rightStatus = Number(right.shelf_status || 0);
      if (leftStatus !== rightStatus) return leftStatus - rightStatus;
      return Number(right.id || 0) - Number(left.id || 0);
    })
    .slice(0, 30)
    .map((song) => ({
      value: buildCatalogLabel(song),
      song
    }));
  callback(options);
};

const handleCatalogSelect = (item: Record<string, any>) => {
  const song = item.song as SongCatalogItem | undefined;
  if (!song) return;
  form.catalogSongNo = Number(song.id);
  catalogKeyword.value = buildCatalogLabel(song);
};

const buildRequestBody = () => {
  const body = {
    songNo: isCreateMode.value ? (isCustomMode.value ? form.songNo : form.catalogSongNo) : form.songNo,
    level: form.level,
    title: undefined as string | undefined,
    titleJp: undefined as string | undefined,
    values: {
      high_score: form.high_score,
      best_score_rank: form.best_score_rank,
      good_cnt: form.good_cnt,
      ok_cnt: form.ok_cnt,
      ng_cnt: form.ng_cnt,
      pound_cnt: form.pound_cnt,
      stage_cnt: form.stage_cnt,
      clear_cnt: form.clear_cnt,
      full_combo_cnt: form.full_combo_cnt,
      dondaful_combo_cnt: form.dondaful_combo_cnt,
      combo_cnt: form.combo_cnt
    }
  };

  if (isCreateMode.value && isCustomMode.value) {
    body.title = form.title.trim();
    body.titleJp = form.titleJp.trim() || undefined;
  }
  return body;
};

const submit = async () => {
  if (saving.value) return;
  if (isCreateMode.value) {
    if (isCustomMode.value) {
      if (!Number.isInteger(form.songNo) || form.songNo <= 0) {
        ElMessage.error("请填写有效的歌曲 ID");
        return;
      }
      if (!form.title.trim()) {
        ElMessage.error("未收录曲目至少要填写一个曲名");
        return;
      }
    } else if (!selectedCatalogSong.value) {
      ElMessage.error("请先从目录中选择一首歌");
      return;
    }
  }

  saving.value = true;
  try {
    await $fetch(isCreateMode.value ? "/api/account/songs/create" : "/api/account/songs/update", {
      method: "POST",
      body: buildRequestBody()
    });
    ElMessage.success(isCreateMode.value ? "谱面记录已新增并默认锁定" : "谱面记录已保存");
    visible.value = false;
    emit("saved");
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || "保存失败");
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <el-dialog v-model="visible" width="min(760px, 100%)" :title="dialogTitle">
    <div v-if="isCreateMode" class="create-head">
      <el-alert
        title="新增记录会默认写入锁定表，后续同步和抓取不会自动覆盖或删除该谱面。"
        type="info"
        :closable="false"
        show-icon
      />
      <el-radio-group v-model="form.sourceType" class="source-toggle">
        <el-radio-button label="catalog">从歌曲目录选择</el-radio-button>
        <el-radio-button label="custom">手动录入未收录曲目</el-radio-button>
      </el-radio-group>
    </div>

    <div v-if="isCreateMode && !isCustomMode" class="catalog-picker">
      <el-form-item label="查找歌曲">
        <el-autocomplete
          v-model="catalogKeyword"
          class="catalog-autocomplete"
          clearable
          placeholder="搜索曲名、日文名或歌曲 ID"
          :fetch-suggestions="queryCatalogSongs"
          @select="handleCatalogSelect"
        />
      </el-form-item>
      <div v-if="selectedCatalogSong" class="catalog-summary">
        <strong>{{ selectedCatalogSong.song_name }}</strong>
        <span>{{ selectedCatalogSong.song_name_jp || `ID ${selectedCatalogSong.id}` }}</span>
        <el-tag size="small" :type="Number(selectedCatalogSong.shelf_status || 0) === 1 ? 'warning' : 'success'" effect="light">
          {{ Number(selectedCatalogSong.shelf_status || 0) === 1 ? "已下架" : "现有曲目" }}
        </el-tag>
      </div>
      <p class="catalog-hint">已下架歌曲也能直接搜索；未上线或未收录曲目请切换到“手动录入未收录曲目”。</p>
    </div>

    <div v-if="isCreateMode && isCustomMode" class="custom-grid">
      <el-form-item label="歌曲 ID">
        <el-input-number v-model="form.songNo" :min="1" :step="1" />
      </el-form-item>
      <el-form-item label="曲名">
        <el-input v-model="form.title" placeholder="例如：新曲测试版" />
      </el-form-item>
      <el-form-item label="日文名">
        <el-input v-model="form.titleJp" placeholder="可留空" />
      </el-form-item>
    </div>

    <div v-if="!isCreateMode" class="dialog-head">
      <strong>{{ form.title }}</strong>
      <span>ID {{ form.songNo }} / {{ form.level }}</span>
    </div>

    <div class="edit-grid">
      <el-form-item label="难度">
        <el-select v-model="form.level" :disabled="!isCreateMode || !availableLevelOptions.length">
          <el-option v-for="option in availableLevelOptions" :key="option.value" :label="option.label" :value="option.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="分数">
        <el-input-number v-model="form.high_score" :min="0" :step="100" />
      </el-form-item>
      <el-form-item label="评价">
        <el-input-number v-model="form.best_score_rank" :min="0" :max="9" />
      </el-form-item>
      <el-form-item label="良">
        <el-input-number v-model="form.good_cnt" :min="0" />
      </el-form-item>
      <el-form-item label="可">
        <el-input-number v-model="form.ok_cnt" :min="0" />
      </el-form-item>
      <el-form-item label="不可">
        <el-input-number v-model="form.ng_cnt" :min="0" />
      </el-form-item>
      <el-form-item label="连打数">
        <el-input-number v-model="form.pound_cnt" :min="0" />
      </el-form-item>
      <el-form-item label="最大连击">
        <el-input-number v-model="form.combo_cnt" :min="0" />
      </el-form-item>
      <el-form-item label="游玩次数">
        <el-input-number v-model="form.stage_cnt" :min="0" />
      </el-form-item>
      <el-form-item label="过关次数">
        <el-input-number v-model="form.clear_cnt" :min="0" />
      </el-form-item>
      <el-form-item label="全连次数">
        <el-input-number v-model="form.full_combo_cnt" :min="0" />
      </el-form-item>
      <el-form-item label="全良次数">
        <el-input-number v-model="form.dondaful_combo_cnt" :min="0" />
      </el-form-item>
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">
        {{ isCreateMode ? "新增并锁定" : "保存" }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.create-head {
  display: grid;
  gap: 14px;
  margin-bottom: 14px;
}

.source-toggle {
  justify-content: flex-start;
}

.catalog-picker,
.custom-grid,
.dialog-head {
  margin-bottom: 14px;
}

.catalog-autocomplete {
  width: 100%;
}

.catalog-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin-top: 4px;
}

.catalog-summary span,
.catalog-hint,
.dialog-head span {
  color: #7d6a5a;
}

.catalog-hint {
  margin: 8px 0 0;
  line-height: 1.6;
  font-size: 13px;
}

.custom-grid,
.edit-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 18px;
}

@media (max-width: 860px) {
  .custom-grid,
  .edit-grid {
    grid-template-columns: 1fr;
  }
}
</style>
