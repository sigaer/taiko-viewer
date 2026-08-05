<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { buildPageDescription } from "~/utils/seo";
import { viewerErrorAlertType } from "~/utils/viewerError";

type ProgressKind = "dani" | "constant" | "star" | "named";
type ConstantMode = "pass" | "comprehensive";

interface ProgressOptions {
  dani: Array<{ version: string; grades: string[] }>;
  constants: { pass: string[]; comprehensive: string[] };
  stars: number[];
  named: string[];
  pages: {
    pass: Record<string, number>;
    comprehensive: Record<string, number>;
    star: Record<string, number>;
    named: Record<string, number>;
  };
}

const { t, locale } = useI18n();
const apiFetch = useViewerApiFetch();
const { accountUser, fetchCurrentUser } = useAccountState();
await fetchCurrentUser();

definePageMeta({
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

const options = ref<ProgressOptions | null>(null);
const optionsLoading = ref(false);
const optionsError = ref("");
const kind = ref<ProgressKind>("dani");
const version = ref("");
const grade = ref("");
const constantMode = ref<ConstantMode>("pass");
const constant = ref("");
const star = ref(10);
const named = ref("");
const page = ref(1);

const { imageUrl, loading, errorMessage, loadChart, revokeUrl } = useToolChartImage();

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
  if (!options.value) return false;
  if (kind.value === "dani") return Boolean(version.value && grade.value);
  if (kind.value === "constant") return Boolean(constant.value);
  if (kind.value === "star") return options.value.stars.includes(star.value);
  return Boolean(named.value);
});

const requestQuery = () => {
  const base = { kind: kind.value, page: page.value };
  if (kind.value === "dani") return { ...base, version: version.value, grade: grade.value };
  if (kind.value === "constant") {
    return { ...base, mode: constantMode.value, constant: constant.value };
  }
  if (kind.value === "star") return { ...base, star: star.value };
  return { ...base, name: named.value };
};

const submit = async () => {
  if (!canSubmit.value) return;
  page.value = Math.min(page.value, totalPages.value);
  await loadChart("/api/account/progress/image", requestQuery());
};

const movePage = async (offset: number) => {
  page.value = Math.min(totalPages.value, Math.max(1, page.value + offset));
  await submit();
};

const loadOptions = async () => {
  optionsLoading.value = true;
  optionsError.value = "";
  try {
    options.value = await apiFetch<ProgressOptions>("/api/account/progress/options", {
      credentials: "include"
    });
    const newest = options.value.dani[0];
    version.value = newest?.version || "";
    grade.value = newest?.grades.includes("十段") ? "十段" : newest?.grades.at(-1) || "";
    constant.value = options.value.constants.pass[0] || "";
    star.value = options.value.stars.includes(10) ? 10 : options.value.stars.at(-1) || 1;
    named.value = options.value.named[0] || "";
    await submit();
  } catch (error: unknown) {
    optionsError.value = await resolveViewerError(error, copy.value.loadFailed);
  } finally {
    optionsLoading.value = false;
  }
};

watch(version, () => {
  const grades = gradeOptions.value;
  grade.value = grades.includes(grade.value) ? grade.value : grades.at(-1) || "";
});
watch(constantMode, () => {
  constant.value = constantOptions.value[0] || "";
});
watch([kind, version, grade, constantMode, constant, star, named], () => {
  page.value = 1;
  revokeUrl();
});

onMounted(() => {
  if (accountUser.value) void loadOptions();
});
</script>

<template>
  <div class="progress-page">
    <ToolsAccountToolGate>
      <section class="progress-workbench">
        <div class="kind-switch" aria-label="Progress type">
          <el-segmented v-model="kind" :options="copy.kinds" block />
        </div>

        <el-skeleton v-if="optionsLoading" :rows="3" animated class="control-skeleton" />
        <el-alert
          v-else-if="optionsError"
          :title="optionsError"
          :type="viewerErrorAlertType(optionsError)"
          show-icon
          :closable="false"
          class="viewer-friendly-alert"
        />
        <el-form v-else-if="options" class="progress-form" label-position="top" @submit.prevent="submit">
          <div v-if="kind === 'dani'" class="control-grid">
            <el-form-item :label="copy.version">
              <el-select v-model="version">
                <el-option v-for="item in options.dani" :key="item.version" :label="`虹 ${item.version}`" :value="item.version" />
              </el-select>
            </el-form-item>
            <el-form-item :label="copy.grade">
              <el-select v-model="grade" filterable>
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
              <el-select v-model="constant" filterable>
                <el-option v-for="item in constantOptions" :key="item" :label="item" :value="item" />
              </el-select>
            </el-form-item>
          </div>

          <div v-else-if="kind === 'star'" class="control-grid control-grid--single">
            <el-form-item :label="copy.star">
              <el-select v-model="star">
                <el-option v-for="item in options.stars" :key="item" :label="`${item} ★`" :value="item" />
              </el-select>
            </el-form-item>
          </div>

          <div v-else class="control-grid control-grid--single">
            <el-form-item :label="copy.named">
              <el-select v-model="named" filterable>
                <el-option v-for="item in options.named" :key="item" :label="item" :value="item" />
              </el-select>
            </el-form-item>
          </div>

          <div class="primary-actions">
            <el-button type="primary" size="large" :loading="loading" :disabled="!canSubmit" native-type="submit">
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

        <div v-if="loading && !imageUrl" class="image-loading" aria-live="polite">
          <span class="beat-dot"></span>
          <span class="beat-dot"></span>
          <span class="beat-dot"></span>
        </div>

        <section v-if="imageUrl" class="progress-result">
          <div class="result-toolbar">
            <div v-if="totalPages > 1" class="pager">
              <el-button :disabled="loading || page <= 1" @click="movePage(-1)">{{ copy.previous }}</el-button>
              <span>{{ pageText }}</span>
              <el-button :disabled="loading || page >= totalPages" @click="movePage(1)">{{ copy.next }}</el-button>
            </div>
            <a :href="imageUrl" download="taiko-progress.png" class="download-link">
              <el-button>{{ copy.download }}</el-button>
            </a>
          </div>
          <div class="image-stage">
            <img :src="imageUrl" :alt="copy.imageAlt" class="progress-image" />
          </div>
        </section>
      </section>
    </ToolsAccountToolGate>
  </div>
</template>

<style scoped>
.progress-page {
  width: 100%;
}

.progress-workbench {
  display: grid;
  gap: 20px;
}

.kind-switch {
  width: min(100%, 620px);
}

.progress-form {
  padding: 20px 0 18px;
  border-top: 1px solid rgba(139, 107, 77, 0.18);
  border-bottom: 1px solid rgba(139, 107, 77, 0.18);
}

.control-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 280px));
  gap: 16px;
  align-items: end;
}

.control-grid--single {
  grid-template-columns: minmax(0, 360px);
}

.control-grid :deep(.el-form-item) {
  margin-bottom: 0;
}

.control-grid :deep(.el-select),
.control-grid :deep(.el-segmented) {
  width: 100%;
}

.primary-actions {
  margin-top: 18px;
}

.result-alert {
  margin-top: 2px;
}

.image-loading {
  min-height: 240px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border-top: 1px solid rgba(139, 107, 77, 0.14);
  border-bottom: 1px solid rgba(139, 107, 77, 0.14);
}

.beat-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #e45543;
  animation: progress-beat 1s ease-in-out infinite;
}

.beat-dot:nth-child(2) {
  background: #f1ae42;
  animation-delay: 0.12s;
}

.beat-dot:nth-child(3) {
  background: #5792c5;
  animation-delay: 0.24s;
}

.progress-result {
  min-width: 0;
}

.result-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.pager {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #6c5a4b;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.download-link {
  margin-left: auto;
  text-decoration: none;
}

.image-stage {
  overflow: auto;
  padding: 12px;
  background: #ede8df;
  border: 1px solid rgba(111, 87, 66, 0.14);
  border-radius: 8px;
  text-align: center;
}

.progress-image {
  display: block;
  width: auto;
  max-width: 100%;
  height: auto;
  margin: 0 auto;
  box-shadow: 0 8px 22px rgba(62, 46, 34, 0.14);
}

@keyframes progress-beat {
  0%, 100% { transform: translateY(0); opacity: 0.42; }
  50% { transform: translateY(-7px); opacity: 1; }
}

@media (max-width: 640px) {
  .progress-workbench { gap: 16px; }
  .kind-switch { width: 100%; }
  .kind-switch :deep(.el-segmented__item-label) { font-size: 12px; }
  .progress-form { padding-top: 16px; }
  .control-grid { grid-template-columns: minmax(0, 1fr); gap: 14px; }
  .primary-actions :deep(.el-button) { width: 100%; }
  .result-toolbar { align-items: stretch; flex-direction: column; }
  .pager { display: grid; grid-template-columns: auto minmax(90px, 1fr) auto; text-align: center; }
  .download-link { margin-left: 0; }
  .download-link :deep(.el-button) { width: 100%; }
  .image-stage { margin-inline: -8px; padding: 6px; }
}

@media (prefers-reduced-motion: reduce) {
  .beat-dot { animation: none; opacity: 0.8; }
}
</style>
