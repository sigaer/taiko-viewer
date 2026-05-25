<script setup lang="ts">
import { computed } from "vue";
import { buildPageDescription } from "~/utils/seo";
import { viewerErrorAlertType } from "~/utils/viewerError";

const { t, locale } = useI18n();

definePageMeta({
  pageTitleKey: "tools.wordCloud",
  pageDescKey: "page.tools.wordCloud.desc",
  navKey: "/tools/word-cloud",
  breadcrumbs: [
    { labelKey: "tools.title", to: "/tools" },
    { labelKey: "tools.wordCloud", to: "/tools/word-cloud" }
  ]
});

useViewerSeo(() => ({
  title: t("tools.wordCloud"),
  description: buildPageDescription(t("page.tools.wordCloud.desc")),
  path: "/tools/word-cloud"
}));

const { imageUrl, loading, errorMessage, loadChart } = useToolChartImage();
const copy = computed(() =>
  locale.value === "ja"
    ? {
        hint: "現在連携中のアカウントのプレイ記録からワードクラウドを生成します。先に同期を完了してください。",
        submit: "ワードクラウドを生成",
        imageAlt: "太鼓ワードクラウド"
      }
    : {
        hint: "根据当前绑定账号的游玩记录生成词云，需先完成多端同步。",
        submit: "生成词云",
        imageAlt: "太鼓词云"
      }
);

const submit = async () => {
  await loadChart("/api/account/charts/word-cloud");
};
</script>

<template>
  <div class="page-stack">
    <AccountToolGate>
      <el-card class="panel-card">
        <p class="hint">{{ copy.hint }}</p>
        <el-button type="primary" :loading="loading" @click="submit">{{ copy.submit }}</el-button>
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
