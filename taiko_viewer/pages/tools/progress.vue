<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { buildPageDescription } from "~/utils/seo";
import { viewerErrorAlertType } from "~/utils/viewerError";

type ProgressKind = "dani" | "constant" | "star" | "named";
type ConstantMode = "pass" | "comprehensive";

const { t, locale } = useI18n();
const { accountUser, fetchCurrentUser } = useAccountState();
await fetchCurrentUser();

definePageMeta({
  contentLayout: "wide",
  pageTitleKey: "tools.progress",
  pageDescKey: "page.tools.progress.desc",
  navKey: "/tools/progress",
  breadcrumbs: [
    { labelKey: "tools.title", to: "/tools" },
    { labelKey: "tools.progress", to: "/tools/progress" }
  ]
});

useViewerSeo(() => ({
  title: t("tools.progress"),
  description: buildPageDescription(t("page.tools.progress.desc")),
  path: "/tools/progress"
}));

const copy = computed(() =>
  locale.value === "ja"
    ? {
        kinds: [
          { label: "段位", value: "dani" },
          { label: "定数", value: "constant" },
          { label: "星", value: "star" },
          { label: "全良難易度", value: "named" }
        ],
        version: "バージョン",
        grade: "段位",
        constantMode: "定数基準",
        pass: "クリア難易度",
        comprehensive: "総合難易度",
        constant: "定数",
        star: "星",
        named: "全良難易度",
        generate: "進捗画像を表示",
        refresh: "更新",
        previous: "前へ",
        next: "次へ",
        page: "{page} / {total} ページ",
        download: "画像を保存",
        imageAlt: "楽曲進捗画像",
        loadFailed: "進捗項目を読み込めませんでした",
        imageFailed: "進捗画像を生成できませんでした"
      }
    : {
        kinds: [
          { label: "段位", value: "dani" },
          { label: "定数", value: "constant" },
          { label: "星级", value: "star" },
          { label: "全良难度", value: "named" }
        ],
        version: "版本",
        grade: "段位",
        constantMode: "定数口径",
        pass: "过关难度",
        comprehensive: "综合难度",
        constant: "定数",
        star: "星级",
        named: "全良难度",
        generate: "查看进度图",
        refresh: "刷新",
        previous: "上一页",
        next: "下一页",
        page: "第 {page} / {total} 页",
        download: "保存图片",
        imageAlt: "歌曲进度图片",
        loadFailed: "进度选项加载失败",
        imageFailed: "进度图片生成失败，请稍后重试"
      }
);

const { options, optionsLoading, optionsError, loadOptions } = useProgressOptions();
const kind = ref<ProgressKind>("dani");
const version = ref("");
const grade = ref("");
const constantMode = ref<ConstantMode>("pass");
const constant = ref("");
const star = ref(10);
const named = ref("");
const page = ref(1);



const gradeOptions = computed(
  () => options.value?.dani.find((item) => item.version === version.value)?.grades || []
);
const constantOptions = computed(() => options.value?.constants[constantMode.value] || []);
const totalPages = computed(() => {
  if (!options.value || kind.value === "dani") return 1;
  if (kind.value === "constant") return options.value.pages[constantMode.value][constant.value] || 1;
  if (kind.value === "star") return options.value.pages.star[String(star.value)] || 1;
  return options.value.pages.named[named.value] || 1;
});
const pageText = computed(() =>
  copy.value.page.replace("{page}", String(page.value)).replace("{total}", String(totalPages.value))
);
const canSubmit = computed(() => {
  if (!options.value || optionsLoading.value || optionsError.value) return false;
  if (kind.value === "dani") return gradeOptions.value.includes(grade.value);
  if (kind.value === "constant") return constantOptions.value.includes(constant.value);
  if (kind.value === "star") return options.value.stars.includes(star.value);
  return options.value.named.includes(named.value);
});

const requestQuery = computed(() => {
  const base = { kind: kind.value, page: page.value };
  if (kind.value === "dani") return { ...base, version: version.value, grade: grade.value };
  if (kind.value === "constant") {
    return { ...base, mode: constantMode.value, constant: constant.value };
  }
  if (kind.value === "star") return { ...base, star: star.value };
  return { ...base, name: named.value };
});
const { imageUrl, loading, errorMessage, resultQuery, changed, generate, invalidate } = useToolChartResult(requestQuery);

const submit = async () => {
  if (!canSubmit.value || loading.value) return;
  page.value = Math.min(page.value, totalPages.value);
  await generate("/api/account/progress/image");
};

const movePage = async (offset: number) => {
  page.value = Math.min(totalPages.value, Math.max(1, page.value + offset));
  await submit();
};

const stateCopy = computed(() => locale.value === "ja" ? {
  type:"進捗タイプ", loadingOptions:"項目を読み込み中…", empty:"この種類には選択できる項目がありません", retry:"再試行", ready:"条件を選んで進捗画像を表示してください", changed:"条件を変更しました。進捗画像を再生成してください", generating:"進捗画像を生成中…", result:"生成結果", view:"画像を拡大"
} : {
  type:"进度类型", loadingOptions:"正在读取进度选项…", empty:"当前类型暂无可用选项", retry:"重试", ready:"选择条件后查看进度图", changed:"条件已修改，请重新生成进度图", generating:"正在生成进度图…", result:"生成结果", view:"放大查看图片"
});
const resultSummary = computed(() => {
  const q = resultQuery.value;
  if (!q) return "";
  const type = copy.value.kinds.find(item => item.value === q.kind)?.label;
  if (q.kind === "dani") return `${type} · 虹 ${q.version} · ${q.grade}`;
  if (q.kind === "constant") return `${type} · ${q.mode === "pass" ? copy.value.pass : copy.value.comprehensive} · ${q.constant}`;
  if (q.kind === "star") return `${type} · ★${q.star}`;
  return `${type} · ${q.name}`;
});
watch(options, async (value) => {
  invalidate(); resultQuery.value = null;
  if (!value) return;
  const newest = value.dani[0];
  version.value = newest?.version || "";
  grade.value = newest?.grades.includes("十段") ? "十段" : newest?.grades.at(-1) || "";
  constant.value = value.constants[constantMode.value][0] || "";
  star.value = value.stars.includes(10) ? 10 : value.stars.at(-1) || 1;
  named.value = value.named[0] || "";
  page.value = 1;
  await nextTick();
  if (options.value === value) await submit();
});

watch(version, () => {
  const grades = gradeOptions.value;
  grade.value = grades.includes(grade.value) ? grade.value : grades.at(-1) || "";
});
watch(constantMode, () => {
  constant.value = constantOptions.value[0] || "";
});
watch([kind, version, grade, constantMode, constant, star, named], () => {
  page.value = 1;

});

onMounted(() => {
  if (accountUser.value) void loadOptions();
});
</script>

<template>
  <div class="progress-page">
    <ToolsAccountToolGate>
      <section class="progress-workbench">
        <div class="kind-switch" :aria-label="stateCopy.type">
          <el-segmented v-model="kind" :options="copy.kinds" block />
        </div>

        <div v-if="optionsLoading" role="status"><p class="state-text">{{ stateCopy.loadingOptions }}</p><el-skeleton :rows="2" class="control-skeleton" /></div>
        <el-alert
          v-else-if="optionsError"
          :title="optionsError"
          :type="viewerErrorAlertType(optionsError)"
          show-icon
          :closable="false"
          class="viewer-friendly-alert"
        ><el-button @click="loadOptions">{{ stateCopy.retry }}</el-button></el-alert>
        <el-form v-else-if="options" class="progress-form" label-position="top" @submit.prevent="submit">
          <div v-if="kind === 'dani'" class="control-grid">
            <el-form-item :label="copy.version">
              <el-select v-model="version" :disabled="!options.dani.length">
                <el-option v-for="item in options.dani" :key="item.version" :label="`虹 ${item.version}`" :value="item.version" />
              </el-select>
            </el-form-item>
            <el-form-item :label="copy.grade">
              <el-select v-model="grade" :disabled="!gradeOptions.length" filterable>
                <el-option v-for="item in gradeOptions" :key="item" :label="item" :value="item" />
              </el-select>
            </el-form-item>
          </div>

          <div v-else-if="kind === 'constant'" class="control-grid">
            <el-form-item :label="copy.constantMode">
              <el-segmented
                v-model="constantMode"
                :options="[
                  { label: copy.pass, value: 'pass' },
                  { label: copy.comprehensive, value: 'comprehensive' }
                ]"
                block
              />
            </el-form-item>
            <el-form-item :label="copy.constant">
              <el-select v-model="constant" :disabled="!constantOptions.length" filterable>
                <el-option v-for="item in constantOptions" :key="item" :label="item" :value="item" />
              </el-select>
            </el-form-item>
          </div>

          <div v-else-if="kind === 'star'" class="control-grid control-grid--single">
            <el-form-item :label="copy.star">
              <el-select v-model="star" :disabled="!options.stars.length">
                <el-option v-for="item in options.stars" :key="item" :label="`${item} ★`" :value="item" />
              </el-select>
            </el-form-item>
          </div>

          <div v-else class="control-grid control-grid--single">
            <el-form-item :label="copy.named">
              <el-select v-model="named" :disabled="!options.named.length" filterable>
                <el-option v-for="item in options.named" :key="item" :label="item" :value="item" />
              </el-select>
            </el-form-item>
          </div>

          <p v-if="!canSubmit" class="state-text" role="status">{{ stateCopy.empty }}</p>
          <div class="primary-actions">
            <el-button type="primary" :loading="loading" :disabled="!canSubmit" native-type="submit">
              {{ imageUrl ? copy.refresh : copy.generate }}
            </el-button>
          </div>
        </el-form>

        <el-alert
          v-if="errorMessage"
          :title="errorMessage || copy.imageFailed"
          :type="viewerErrorAlertType(errorMessage)"
          show-icon
          :closable="false"
          class="result-alert viewer-friendly-alert"
        />

        <p v-if="loading" class="state-text" role="status">{{ stateCopy.generating }}</p>
        <p v-else-if="canSubmit && !imageUrl && !errorMessage" class="state-text" role="status">{{ changed ? stateCopy.changed : stateCopy.ready }}</p>

        <section v-if="imageUrl && resultQuery" class="progress-result">
          <header class="result-heading"><h2>{{ stateCopy.result }}</h2><p>{{ resultSummary }}</p></header>
          <div class="result-toolbar">
            <div class="pager">
              <el-button :disabled="loading || page <= 1" @click="movePage(-1)">{{ copy.previous }}</el-button>
              <span>{{ pageText }}</span>
              <el-button :disabled="loading || page >= totalPages" @click="movePage(1)">{{ copy.next }}</el-button>
            </div>
            <a :href="imageUrl" download="taiko-progress.png" class="download-link">
              <el-button>{{ copy.download }}</el-button>
            </a>
          </div>
          <a :href="imageUrl" target="_blank" rel="noopener" class="image-stage" :aria-label="stateCopy.view">
            <img :src="imageUrl" :alt="`${copy.imageAlt} · ${resultSummary} · ${pageText}`" class="progress-image" />
          </a>
        </section>
      </section>
    </ToolsAccountToolGate>
  </div>
</template>

<style scoped>
.progress-page, .progress-result { width:100%; min-width:0; }
.progress-workbench { display:grid; gap:20px; }
.kind-switch { width:min(100%, var(--viewer-content-reading)); }
.progress-form { display:flex; align-items:flex-end; flex-wrap:wrap; gap:16px; padding-bottom:20px; border-bottom:1px solid var(--viewer-border); }
.control-grid { display:grid; grid-template-columns:repeat(2,minmax(0,260px)); gap:16px; align-items:end; }
.control-grid--single { grid-template-columns:minmax(0,300px); }
.control-grid :deep(.el-form-item) { margin-bottom:0; min-width:0; }
.control-grid :deep(.el-select), .control-grid :deep(.el-segmented) { width:100%; }
.state-text { margin:0; color:var(--viewer-text-muted); font-size:14px; line-height:1.7; }
.progress-form > .state-text { flex-basis:100%; }
.result-heading { display:flex; flex-wrap:wrap; align-items:baseline; gap:8px 20px; margin-bottom:12px; }
.result-heading h2 { margin:0; font-size:18px; }
.result-heading p { margin:0; color:var(--viewer-text-muted); font-size:14px; }
.result-toolbar { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; margin-bottom:12px; }
.pager { display:flex; align-items:center; flex-wrap:wrap; gap:12px; color:var(--viewer-text-muted); font-size:14px; font-variant-numeric:tabular-nums; }
.download-link { margin-left:auto; text-decoration:none; }
.image-stage { display:block; width:fit-content; max-width:100%; }
.progress-image { display:block; width:auto; max-width:100%; height:auto; }
@media(max-width:640px) {
 .progress-workbench { gap:16px; }
 .kind-switch { width:100%; }
 .kind-switch :deep(.el-segmented__item-label) { font-size:13px; }
 .progress-form { display:grid; grid-template-columns:minmax(0,1fr); gap:14px; }
 .control-grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
 .control-grid--single { grid-template-columns:minmax(0,1fr); }
 .primary-actions :deep(.el-button) { width:100%; }
 .result-toolbar { align-items:stretch; flex-direction:column; }
 .pager { display:grid; grid-template-columns:auto minmax(70px,1fr) auto; gap:8px; text-align:center; }
 .pager :deep(.el-button + .el-button) { margin:0; }
 .download-link { margin:0; }
 .download-link :deep(.el-button) { width:100%; }
}
</style>
