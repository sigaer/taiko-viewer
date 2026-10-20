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
    { labelKey: "tools.title", to: "/tools" },
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
const { imageUrl, loading, errorMessage, loadChart } = useToolChartImage();
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
  await loadChart("/api/account/charts/b30", {
    n: n.value,
    dim: dim.value || undefined,
    r: dynamicOrigin.value ? "1" : undefined
  });
};
</script>

<template>
  <div class="page-stack">
    <AccountToolGate>
      <el-card class="panel-card">
        <p class="hint">{{ copy.hint }}</p>
        <el-form label-position="top" @submit.prevent="submit">
          <el-form-item :label="copy.topN">
            <el-input-number v-model="n" :min="1" :max="50" controls-position="right" />
          </el-form-item>
          <el-form-item :label="copy.dim">
            <el-select v-model="dim" clearable :placeholder="copy.placeholder">
              <el-option v-for="option in dimOptions" :key="option.value" :label="option.label" :value="option.value" />
            </el-select>
          </el-form-item>
          <el-form-item :label="copy.dynamicOrigin">
            <el-switch v-model="dynamicOrigin" />
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
