<script setup lang="ts">
import { computed, ref } from "vue";
import { buildPageDescription } from "~/utils/seo";
import { viewerErrorAlertType } from "~/utils/viewerError";

const { t, locale } = useI18n();

definePageMeta({
  pageTitleKey: "tools.recommend",
  pageDescKey: "page.tools.recommend.desc",
  navKey: "/tools/recommend",
  breadcrumbs: [
    { labelKey: "tools.title", to: "/tools" },
    { labelKey: "tools.recommend", to: "/tools/recommend" }
  ]
});

useViewerSeo(() => ({
  title: t("tools.recommend"),
  description: buildPageDescription(t("page.tools.recommend.desc")),
  path: "/tools/recommend"
}));

const n = ref(20);
const dim = ref("");
const { imageUrl, loading, errorMessage, loadChart } = useToolChartImage();
const copy = computed(() =>
  locale.value === "ja"
    ? {
        hint: "対応コマンド: taikorec / 推荐歌曲 / taikorec 体力 30",
        count: "推薦数（1-50）",
        dim: "指標（任意）",
        placeholder: "空欄なら総合 Rating",
        submit: "画像を生成",
        imageAlt: "おすすめ楽曲"
      }
    : {
        hint: "对应 taikorec / 推荐歌曲 / taikorec 体力 30",
        count: "推荐数量（1-50）",
        dim: "维度（可选）",
        placeholder: "留空为综合 Rating",
        submit: "生成推荐图",
        imageAlt: "推荐歌曲"
      }
);
const dimOptions = computed(() =>
  locale.value === "ja"
    ? [
        { label: "総合 Rating", value: "综合" },
        { label: "大歌力", value: "大歌力" },
        { label: "体力", value: "体力" },
        { label: "高速処理", value: "高速处理" },
        { label: "精度力", value: "精度力" },
        { label: "リズム処理", value: "节奏处理" },
        { label: "複合処理", value: "复合处理" }
      ]
    : [
        { label: "综合 Rating", value: "综合" },
        { label: "大歌力", value: "大歌力" },
        { label: "体力", value: "体力" },
        { label: "高速处理", value: "高速处理" },
        { label: "精度力", value: "精度力" },
        { label: "节奏处理", value: "节奏处理" },
        { label: "复合处理", value: "复合处理" }
      ]
);

const submit = async () => {
  await loadChart("/api/account/charts/recommend", {
    n: n.value,
    dim: dim.value || undefined
  });
};
</script>

<template>
  <div class="page-stack">
    <AccountToolGate>
      <el-card class="panel-card">
        <p class="hint">{{ copy.hint }}</p>
        <el-form label-position="top" @submit.prevent="submit">
          <el-form-item :label="copy.count">
            <el-input-number v-model="n" :min="1" :max="50" controls-position="right" />
          </el-form-item>
          <el-form-item :label="copy.dim">
            <el-select v-model="dim" clearable :placeholder="copy.placeholder">
              <el-option v-for="option in dimOptions" :key="option.value" :label="option.label" :value="option.value" />
            </el-select>
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
  color: #6c5a4b;
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
  box-shadow: 0 10px 24px rgba(46, 35, 26, 0.12);
}
</style>
