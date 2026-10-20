<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElMessage } from "element-plus";

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ "update:modelValue": [value: boolean]; imported: [] }>();
const apiFetch = useViewerApiFetch();
const { locale } = useI18n();
const text = ref("");
const importing = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const copy = computed(() => locale.value === "ja" ? {
  title: "成績をインポート", intro: "userdata の songscore.json を貼り付けるか、ファイルを選択してください。",
  paste: "JSON データ", choose: "ファイルを選択", hint: "songscore.json（JSON）", count: "件の有効な記録",
  invalid: "JSON を確認してください", empty: "有効な scoreInfo がありません", cancel: "キャンセル", submit: "インポート",
  success: "成績をインポートしました", failed: "インポートに失敗しました"
} : {
  title: "导入成绩", intro: "粘贴 userdata 的 songscore.json，或选择 JSON 文件。",
  paste: "JSON 数据", choose: "选择文件", hint: "支持 songscore.json（JSON）", count: "条有效记录",
  invalid: "请检查 JSON 格式", empty: "没有找到有效的 scoreInfo 记录", cancel: "取消", submit: "开始导入",
  success: "成绩导入完成", failed: "导入失败"
});

const visible = computed({ get: () => props.modelValue, set: (value) => emit("update:modelValue", value) });
const parsed = computed<{ value: any; count: number; error?: string }>(() => {
  if (!text.value.trim()) return { value: null, count: 0 };
  try {
    const value = JSON.parse(text.value);
    const root = value?.data && typeof value.data === "object" ? value.data : value;
    const rows = Array.isArray(root?.scoreInfo) ? root.scoreInfo : Array.isArray(root?.songs) ? root.songs : Array.isArray(value) ? value : [];
    return { value, count: rows.filter((item: any) => Number.isInteger(Number(item?.song_no ?? item?.songNo)) && Number(item?.level) >= 1 && Number(item?.level) <= 5).length };
  } catch { return { value: null, count: 0, error: copy.value.invalid }; }
});

watch(() => props.modelValue, (open) => { if (open) { text.value = ""; importing.value = false; } });

const readFile = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { text.value = String(reader.result || ""); };
  reader.readAsText(file);
  (event.target as HTMLInputElement).value = "";
};

const submit = async () => {
  if (!parsed.value.value || parsed.value.error || !parsed.value.count || importing.value) return;
  importing.value = true;
  try {
    const result = await apiFetch<{ created: number; updated: number }>("/api/account/songs/import", { method: "POST", body: parsed.value.value });
    ElMessage.success(`${copy.value.success}（${Number(result.created || 0) + Number(result.updated || 0)}）`);
    visible.value = false;
    emit("imported");
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.failed);
  } finally { importing.value = false; }
};
</script>

<template>
  <el-dialog v-model="visible" :title="copy.title" width="min(680px, calc(100vw - 28px))" class="score-import-dialog">
    <p class="import-intro">{{ copy.intro }}</p>
    <label class="import-label" for="score-import-json">{{ copy.paste }}</label>
    <el-input id="score-import-json" v-model="text" type="textarea" :rows="10" autocomplete="off" spellcheck="false" />
    <div class="import-actions">
      <input ref="fileInput" class="sr-only" type="file" accept=".json,application/json" @change="readFile" />
      <el-button plain @click="fileInput?.click()">{{ copy.choose }}</el-button>
      <span class="import-hint">{{ copy.hint }}</span>
      <span v-if="parsed.error" class="import-error" role="alert">{{ parsed.error }}</span>
      <span v-else-if="text.trim() && !parsed.count" class="import-error" role="alert">{{ copy.empty }}</span>
      <span v-else-if="parsed.count" class="import-count" aria-live="polite">{{ parsed.count }} {{ copy.count }}</span>
    </div>
    <template #footer>
      <el-button @click="visible = false">{{ copy.cancel }}</el-button>
      <el-button type="primary" :loading="importing" :disabled="!parsed.count || Boolean(parsed.error)" @click="submit">{{ copy.submit }}</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.import-intro { margin: 0 0 14px; color:#756452; line-height: 1.65; }
.import-label { display: block; margin-bottom: 7px; color:#4b392c; font-size: 13px; font-weight: 750; }
.import-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: 12px; min-height: 32px; }
.import-hint { color:#8f7c69; font-size: 12px; }
.import-count { color:#2e8a61; font-size: 13px; font-weight: 700; }
.import-error { color:#c94e42; font-size: 13px; font-weight: 650; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
</style>
