<script setup lang="ts">
import AccountToolGate from "~/components/tools/AccountToolGate.vue";
import { computed, ref } from "vue";
import { buildPageDescription } from "~/utils/seo";
import { viewerErrorAlertType } from "~/utils/viewerError";

const { t, locale } = useI18n();

definePageMeta({
  contentLayout: "wide",
  pageTitleKey: "tools.b30",
  pageDescKey: "page.tools.b30.desc",
  navKey: "/tools/b30",
  breadcrumbs: [
    { labelKey: "nav.myTaiko", to: "/my" },
    { labelKey: "tools.b30", to: "/tools/b30" }
  ]
});

useViewerSeo(() => ({
  title: t("tools.b30"),
  description: buildPageDescription(t("page.tools.b30.desc")),
  path: "/tools/b30"
}));

const n = ref(30);
const dim = ref("");
const dynamicOrigin = ref(false);
const query = computed(() => ({ n: n.value, dim: dim.value || undefined, r: dynamicOrigin.value ? "1" : undefined }));
const { imageUrl, loading, errorMessage, resultQuery, changed, generate } = useToolChartResult(query);
const stateCopy = computed(() => locale.value === "ja" ? {
  result:"生成結果", ready:"条件を選んで画像を生成してください", changed:"条件を変更しました。画像を再生成してください", loading:"画像を生成中…", defaultDim:"総合 Rating", fixedOrigin:"通常原点", dynamicOrigin:"動的原点", view:"画像を拡大"
} : {
  result:"生成结果", ready:"选择条件后生成图表", changed:"条件已修改，请重新生成图表", loading:"正在生成图表…", defaultDim:"综合 Rating", fixedOrigin:"默认原点", dynamicOrigin:"动态原点", view:"放大查看图片"
});
const resultSummary = computed(() => resultQuery.value ? `Top ${resultQuery.value.n} · ${dimOptions.value.find(item => item.value === resultQuery.value?.dim)?.label || stateCopy.value.defaultDim} · ${resultQuery.value.r ? stateCopy.value.dynamicOrigin : stateCopy.value.fixedOrigin}` : "");
const copy = computed(() =>
  locale.value === "ja"
    ? {
        hint: "対応コマンド: taikob 30 / taikob 30 精度 / taikob30 -r",
        topN: "Top N（1-50）",
        dim: "単一指標（任意）",
        placeholder: "空欄なら通常の B30 集計画像",
        dynamicOrigin: "動的原点 (-r)",
        submit: "画像を生成",
        imageAlt: "B30 チャート"
      }
    : {
        hint: "对应 taikob 30 / taikob 30 精度 / taikob30 -r",
        topN: "Top N（1-50）",
        dim: "单维模式（可选）",
        placeholder: "留空为默认 B30 汇总图",
        dynamicOrigin: "动态原点 (-r)",
        submit: "生成图表",
        imageAlt: "B30 图表"
      }
);
const dimOptions = computed(() =>
  locale.value === "ja"
    ? [
        { label: "大歌力", value: "大歌" },
        { label: "リズム処理", value: "节奏" },
        { label: "複合処理", value: "复合" },
        { label: "精度力", value: "精度" },
        { label: "体力", value: "体力" },
        { label: "高速処理", value: "高速" }
      ]
    : [
        { label: "大歌力", value: "大歌" },
        { label: "节奏处理", value: "节奏" },
        { label: "复合处理", value: "复合" },
        { label: "精度力", value: "精度" },
        { label: "体力", value: "体力" },
        { label: "高速处理", value: "高速" }
      ]
);

const submit = async () => {
  if (loading.value || !Number.isInteger(n.value) || n.value < 1 || n.value > 50) return;
  await generate("/api/account/charts/b30");
};
</script>

<template>
  <div class="b30-page">
    <AccountToolGate>
      <el-form class="chart-parameters" label-position="top" @submit.prevent="submit">
        <el-form-item :label="copy.topN"><el-input-number v-model="n" :min="1" :max="50" :precision="0" controls-position="right" /></el-form-item>
        <el-form-item :label="copy.dim"><el-select v-model="dim" clearable :placeholder="copy.placeholder"><el-option v-for="option in dimOptions" :key="option.value" :label="option.label" :value="option.value" /></el-select></el-form-item>
        <el-form-item :label="copy.dynamicOrigin"><el-switch v-model="dynamicOrigin" :aria-label="copy.dynamicOrigin" /></el-form-item>
        <el-button type="primary" :loading="loading" :disabled="!n || n < 1 || n > 50" native-type="submit">{{ copy.submit }}</el-button>
      </el-form>
      <el-alert v-if="errorMessage" :title="errorMessage" :type="viewerErrorAlertType(errorMessage)" show-icon :closable="false" class="viewer-friendly-alert" />
      <section class="chart-result" :aria-busy="loading">
        <header v-if="imageUrl && resultQuery" class="result-heading"><h2>{{ stateCopy.result }}</h2><p>{{ resultSummary }}</p></header>
        <p v-if="loading" class="result-state" role="status">{{ stateCopy.loading }}</p>
        <p v-else-if="!imageUrl && !errorMessage" class="result-state" role="status">{{ changed ? stateCopy.changed : stateCopy.ready }}</p>
        <a v-if="imageUrl" :href="imageUrl" target="_blank" rel="noopener" class="image-open" :aria-label="stateCopy.view"><img :src="imageUrl" :alt="`${copy.imageAlt} · ${resultSummary}`" class="chart-image" /></a>
      </section>
    </AccountToolGate>
  </div>
</template>

<style scoped>
.b30-page { display:grid; gap:20px; min-width:0; }
.chart-parameters { display:grid; grid-template-columns:140px minmax(200px,320px) auto auto; align-items:end; gap:16px; padding-bottom:20px; border-bottom:1px solid var(--viewer-border); }
.chart-parameters :deep(.el-form-item) { margin:0; min-width:0; }
.chart-parameters :deep(.el-input-number), .chart-parameters :deep(.el-select) { width:100%; }
.chart-parameters > :deep(.el-button) { justify-self:start; }
.result-heading { display:flex; flex-wrap:wrap; align-items:baseline; gap:8px 20px; margin-bottom:12px; }
.result-heading h2 { margin:0; font-size:18px; }
.result-heading p, .result-state { margin:0; color:var(--viewer-text-muted); font-size:14px; line-height:1.7; }
.chart-result { min-width:0; }
.image-open { display:block; width:fit-content; max-width:100%; }
.chart-image { display:block; max-width:100%; height:auto; }
@media(max-width:740px) {
 .chart-parameters { grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap:14px; }
 .chart-parameters > :deep(.el-button) { width:100%; justify-self:stretch; }
}
</style>
