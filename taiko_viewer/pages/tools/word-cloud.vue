<script setup lang="ts">
import { buildPageDescription } from "~/utils/seo";
import { viewerErrorAlertType } from "~/utils/viewerError";

const pageMeta = {
  title: "太鼓词云",
  desc: buildPageDescription("根据游玩记录生成太鼓词云，对应 bot 指令 tcloud / 太鼓词云。")
};

definePageMeta({
  pageTitle: pageMeta.title,
  pageDesc: pageMeta.desc,
  navKey: "/tools/word-cloud",
  breadcrumbs: [
    { label: "查谱工具", to: "/tools" },
    { label: "太鼓词云", to: "/tools/word-cloud" }
  ]
});

useViewerSeo({
  title: pageMeta.title,
  description: pageMeta.desc,
  path: "/tools/word-cloud"
});

const { imageUrl, loading, errorMessage, loadChart } = useToolChartImage();

const submit = async () => {
  await loadChart("/api/account/charts/word-cloud");
};
</script>

<template>
  <div class="page-stack">
    <AccountToolGate>
      <el-card class="panel-card">
        <p class="hint">根据当前绑定账号的游玩记录生成词云，需先完成多端同步。</p>
        <el-button type="primary" :loading="loading" @click="submit">生成词云</el-button>
        <el-alert
          v-if="errorMessage"
          :title="errorMessage"
          :type="viewerErrorAlertType(errorMessage)"
          show-icon
          :closable="false"
          class="result-alert viewer-friendly-alert"
        />
        <div v-if="imageUrl" class="chart-wrap">
          <img :src="imageUrl" alt="太鼓词云" class="chart-image" />
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
