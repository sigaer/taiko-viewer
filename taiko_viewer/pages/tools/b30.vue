<script setup lang="ts">
import { ref } from "vue";
import { buildPageDescription } from "~/utils/seo";
import { viewerErrorAlertType } from "~/utils/viewerError";

const pageMeta = {
  title: "B30 表",
  desc: buildPageDescription("生成太鼓达人 Rating Top N 汇总图，对应 bot 指令 taikob。")
};

definePageMeta({
  pageTitle: pageMeta.title,
  pageDesc: pageMeta.desc,
  navKey: "/tools/b30",
  breadcrumbs: [
    { label: "查谱工具", to: "/tools" },
    { label: "B30 表", to: "/tools/b30" }
  ]
});

useViewerSeo({
  title: pageMeta.title,
  description: pageMeta.desc,
  path: "/tools/b30"
});

const n = ref(30);
const dim = ref("");
const dynamicOrigin = ref(false);
const { imageUrl, loading, errorMessage, loadChart } = useToolChartImage();

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
        <p class="hint">对应 <code>taikob 30</code> / <code>taikob 30 精度</code> / <code>taikob30 -r</code></p>
        <el-form label-position="top" @submit.prevent="submit">
          <el-form-item label="Top N（1-50）">
            <el-input-number v-model="n" :min="1" :max="50" controls-position="right" />
          </el-form-item>
          <el-form-item label="单维模式（可选）">
            <el-select v-model="dim" clearable placeholder="留空为默认 B30 汇总图">
              <el-option label="大歌力" value="大歌" />
              <el-option label="节奏处理" value="节奏" />
              <el-option label="复合处理" value="复合" />
              <el-option label="精度力" value="精度" />
              <el-option label="体力" value="体力" />
              <el-option label="高速处理" value="高速" />
            </el-select>
          </el-form-item>
          <el-form-item label="动态原点 (-r)">
            <el-switch v-model="dynamicOrigin" />
          </el-form-item>
          <el-button type="primary" :loading="loading" native-type="submit">生成图表</el-button>
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
          <img :src="imageUrl" alt="B30 图表" class="chart-image" />
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
