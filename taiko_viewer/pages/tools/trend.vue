<script setup lang="ts">
import AccountToolGate from "~/components/tools/AccountToolGate.vue";
import { computed, ref } from "vue";
import { buildPageDescription } from "~/utils/seo";
import { viewerErrorAlertType } from "~/utils/viewerError";

const { t, locale } = useI18n();

definePageMeta({
  contentLayout: "wide",
  pageTitleKey: "tools.trend",
  pageDescKey: "page.tools.trend.desc",
  navKey: "/tools/trend",
  breadcrumbs: [
    { labelKey: "tools.title", to: "/tools" },
    { labelKey: "tools.trend", to: "/tools/trend" }
  ]
});

useViewerSeo(() => ({
  title: t("tools.trend"),
  description: buildPageDescription(t("page.tools.trend.desc")),
  path: "/tools/trend"
}));

const n = ref(20);
const maxDays = ref(30);
const dim = ref("");
const barMode = ref(false);
const showAll = ref(false);
const { imageUrl, loading, errorMessage, loadChart } = useToolChartImage();
const copy = computed(() =>
  locale.value === "ja"
    ? {
        hint: "対応コマンド: taikotrend 20 30 / taikotrend 体力 / taikotrend -b",
        points: "表示点数 N（1-50）",
        days: "最大日数（1-365）",
        dimension: "指標（任意）",
        placeholder: "デフォルトでは全指標を表示",
        barMode: "棒グラフモード",
        showAll: "すべての点を表示",
        submit: "画像を生成",
        imageAlt: "Rating 推移グラフ"
      }
    : {
        hint: "对应 taikotrend 20 30 / taikotrend 体力 / taikotrend -b",
        points: "显示点数 N（1-50）",
        days: "最大天数（1-365）",
        dimension: "维度（可选）",
        placeholder: "默认显示全部维度",
        barMode: "柱状图模式",
        showAll: "显示全部点",
        submit: "生成图表",
        imageAlt: "Rating 走势图"
      }
);
const dimOptions = computed(() =>
  locale.value === "ja"
    ? [
        { label: "総合", value: "综合" },
        { label: "大歌力", value: "大歌力" },
        { label: "体力", value: "体力" },
        { label: "高速処理", value: "高速" },
        { label: "精度力", value: "精度" },
        { label: "リズム処理", value: "节奏" },
        { label: "複合処理", value: "复合" }
      ]
    : [
        { label: "综合", value: "综合" },
        { label: "大歌力", value: "大歌力" },
        { label: "体力", value: "体力" },
        { label: "高速处理", value: "高速" },
        { label: "精度力", value: "精度" },
        { label: "节奏处理", value: "节奏" },
        { label: "复合处理", value: "复合" }
      ]
);

const submit = async () => {
  await loadChart("/api/account/charts/trend", {
    n: n.value,
    maxDays: maxDays.value,
    dim: dim.value || undefined,
    bar: barMode.value ? "1" : undefined,
    all: showAll.value ? "1" : undefined
  });
};
</script>

<template>
  <div class="page-stack">
    <AccountToolGate>
      <el-card class="panel-card">
        <p class="hint">{{ copy.hint }}</p>
        <el-form label-position="top" @submit.prevent="submit">
          <el-form-item :label="copy.points">
            <el-input-number v-model="n" :min="1" :max="50" controls-position="right" />
          </el-form-item>
          <el-form-item :label="copy.days">
            <el-input-number v-model="maxDays" :min="1" :max="365" controls-position="right" />
          </el-form-item>
          <el-form-item :label="copy.dimension">
            <el-select v-model="dim" clearable :placeholder="copy.placeholder">
              <el-option v-for="option in dimOptions" :key="option.value" :label="option.label" :value="option.value" />
            </el-select>
          </el-form-item>
          <el-form-item :label="copy.barMode">
            <el-switch v-model="barMode" />
          </el-form-item>
          <el-form-item :label="copy.showAll">
            <el-switch v-model="showAll" />
          </el-form-item>
          <el-button type="primary" :loading="loading" native-type="submit">{{ copy.submit }}</el-button>
        </el-form>
        <el-alert
          v-if="errorMessage"
          :title="errorMessage"
          :type="viewerErrorAlertType(errorMessage)"
          show-icon
          :closable="false"
          class="result-alert viewer-friendly-alert"
        />
        <div v-if="imageUrl" class="chart-wrap">
          <img :src="imageUrl" :alt="copy.imageAlt" class="chart-image" />
        </div>
      </el-card>
    </AccountToolGate>
  </div>
</template>

<style scoped>
.page-stack {
  display: grid;
  gap: 20px;
}

.hint {
  margin: 0 0 14px;
  color:var(--viewer-text-muted);
}

.result-alert {
  margin-top: 16px;
}

.chart-wrap {
  margin-top: 16px;
  text-align: center;
}

.chart-image {
  max-width: 100%;
  border-radius: 12px;
  box-shadow:0 10px 24px var(--viewer-shadow);
}
</style>
