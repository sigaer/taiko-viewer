<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { buildPageDescription } from "~/utils/seo";

// "Progress" (the file name) is a reserved HTML element name for a component.
defineOptions({ name: "ToolsProgressPage" });

type ProgressKind = "dani" | "constant" | "star" | "named";
type ConstantMode = "pass" | "comprehensive";

const { t } = useI18n();
const { accountUser, fetchCurrentUser } = useAccountState();
await fetchCurrentUser();

definePageMeta({
  contentLayout: "wide",
  pageTitleKey: "tools.progress",
  pageDescKey: "page.tools.progress.desc",
  navKey: "/tools/progress",
  hidePageHeader: true,
  breadcrumbs: [
    { labelKey: "nav.myTaiko", to: "/my" },
    { labelKey: "tools.progress", to: "/tools/progress" }
  ]
});

useViewerSeo(() => ({
  title: t("tools.progress"),
  description: buildPageDescription(t("page.tools.progress.desc")),
  path: "/tools/progress"
}));

// Progress kinds of the endpoint (same as the bot's progress commands); labels from the locale files.
const kinds: ProgressKind[] = ["dani", "constant", "star", "named"];
const kindLabel = (value: unknown) => t(`rework.progressTool.kinds.${String(value)}`);

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
const pageText = computed(() => t("rework.progressTool.page", { page: page.value, total: totalPages.value }));
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
const { imageUrl, loading, errorMessage, errorStatus, resultQuery, changed, generate, invalidate } = useToolChartResult(requestQuery);

const submit = async () => {
  if (!canSubmit.value || loading.value) return;
  page.value = Math.min(page.value, totalPages.value);
  await generate("/api/account/progress/image");
};

const movePage = async (offset: number) => {
  page.value = Math.min(totalPages.value, Math.max(1, page.value + offset));
  await submit();
};

const resultSummary = computed(() => {
  const q = resultQuery.value;
  if (!q) return "";
  const type = kindLabel(q.kind);
  if (q.kind === "dani") return `${type} · ${t("rework.progressTool.versionOption", { version: q.version })} · ${q.grade}`;
  if (q.kind === "constant") return `${type} · ${q.mode === "pass" ? t("rework.progressTool.pass") : t("rework.progressTool.comprehensive")} · ${q.constant}`;
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
  <div class="rw-stack">
    <ReworkPageHeader :title="t('tools.progress')" />
    <ReworkGate :need="accountUser ? null : 'login'">
      <div class="rw-seg" role="group" :aria-label="t('rework.progressTool.kind')">
        <button v-for="item in kinds" :key="item" type="button" :aria-pressed="kind === item" @click="kind = item">{{ kindLabel(item) }}</button>
      </div>

      <ReworkState v-if="optionsLoading" kind="loading" :lines="2" compact :title="t('rework.progressTool.optionsLoading')" />
      <ReworkState v-else-if="optionsError" kind="failed" compact :title="optionsError" @retry="loadOptions" />
      <form v-else-if="options" class="rw-form" :aria-label="t('rework.imageTool.params')" @submit.prevent="submit">
        <template v-if="kind === 'dani'">
          <label class="rw-field rw-field--half">
            <span class="rw-field__label">{{ t("rework.progressTool.version") }}</span>
            <select v-model="version" class="rw-select" :disabled="!options.dani.length">
              <option v-for="item in options.dani" :key="item.version" :value="item.version">{{ t("rework.progressTool.versionOption", { version: item.version }) }}</option>
            </select>
          </label>
          <label class="rw-field rw-field--half">
            <span class="rw-field__label">{{ t("rework.progressTool.grade") }}</span>
            <select v-model="grade" class="rw-select" :disabled="!gradeOptions.length">
              <option v-for="item in gradeOptions" :key="item" :value="item">{{ item }}</option>
            </select>
          </label>
        </template>
        <template v-else-if="kind === 'constant'">
          <fieldset class="rw-field">
            <legend class="rw-field__label">{{ t("rework.progressTool.constantMode") }}</legend>
            <div class="rw-seg">
              <button type="button" :aria-pressed="constantMode === 'pass'" @click="constantMode = 'pass'">{{ t("rework.progressTool.pass") }}</button>
              <button type="button" :aria-pressed="constantMode === 'comprehensive'" @click="constantMode = 'comprehensive'">{{ t("rework.progressTool.comprehensive") }}</button>
            </div>
          </fieldset>
          <label class="rw-field rw-field--half">
            <span class="rw-field__label">{{ t("rework.progressTool.constant") }}</span>
            <select v-model="constant" class="rw-select" :disabled="!constantOptions.length">
              <option v-for="item in constantOptions" :key="item" :value="item">{{ item }}</option>
            </select>
          </label>
        </template>
        <label v-else-if="kind === 'star'" class="rw-field rw-field--half">
          <span class="rw-field__label">{{ t("rework.progressTool.star") }}</span>
          <select v-model.number="star" class="rw-select" :disabled="!options.stars.length">
            <option v-for="item in options.stars" :key="item" :value="item">{{ t("rework.progressTool.starOption", { n: item }) }}</option>
          </select>
        </label>
        <label v-else class="rw-field rw-field--grow">
          <span class="rw-field__label">{{ t("rework.progressTool.named") }}</span>
          <select v-model="named" class="rw-select" :disabled="!options.named.length">
            <option v-for="item in options.named" :key="item" :value="item">{{ item }}</option>
          </select>
        </label>
        <button type="submit" class="rw-btn rw-btn--primary" :disabled="!canSubmit || loading" :aria-busy="loading">{{ imageUrl ? t("rework.imageTool.regenerate") : t("rework.progressTool.generate") }}</button>
      </form>

      <ReworkState v-if="options && !optionsLoading && !optionsError && !canSubmit" kind="empty" compact :title="t('rework.progressTool.noOptions')" />
      <ReworkScoresImageResult
        v-else-if="options && !optionsLoading && !optionsError"
        :url="imageUrl"
        :loading="loading"
        :error="errorMessage"
        :status="errorStatus"
        :idle-text="changed ? t('rework.imageTool.changed') : t('rework.progressTool.ready')"
        :alt="t('rework.progressTool.imageAlt')"
        :summary="resultQuery ? `${resultSummary} · ${pageText}` : ''"
        download="taiko-progress.png"
        @retry="submit"
      >
        <template v-if="imageUrl && resultQuery && totalPages > 1" #actions>
          <span class="rw-seg" role="group" :aria-label="t('rework.progressTool.pager')">
            <button type="button" :disabled="loading || page <= 1" @click="movePage(-1)">{{ t("rework.library.prev") }}</button>
            <span class="pt-page num" aria-hidden="true">{{ page }} / {{ totalPages }}</span>
            <button type="button" :disabled="loading || page >= totalPages" @click="movePage(1)">{{ t("rework.library.next") }}</button>
          </span>
        </template>
      </ReworkScoresImageResult>
    </ReworkGate>
  </div>
</template>

<style scoped>
.pt-page {
  display: inline-flex;
  align-items: center;
  padding: 0 10px;
  font-size: 13px;
}
</style>
