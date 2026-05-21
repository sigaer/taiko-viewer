<script setup lang="ts">
import { ref } from "vue";
import { buildPageDescription } from "~/utils/seo";
import { viewerErrorAlertType } from "~/utils/viewerError";

const pageMeta = {
  title: "Rating 走势",
  desc: buildPageDescription("查看 Rating 六维与综合历史走势，对应 bot 指令 taikotrend。")
};

definePageMeta({
  pageTitle: pageMeta.title,
  pageDesc: pageMeta.desc,
  navKey: "/tools/trend",
  breadcrumbs: [
    { label: "查谱工具", to: "/tools" },
    { label: "Rating 走势", to: "/tools/trend" }
  ]
});

useViewerSeo({
  title: pageMeta.title,
  description: pageMeta.desc,
  path: "/tools/trend"
});

const n = ref(20);
const maxDays = ref(30);
const dim = ref("");
const barMode = ref(false);
const showAll = ref(false);
const { imageUrl, loading, errorMessage, loadChart } = useToolChartImage();

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
        <p class="hint">对应 <code>taikotrend 20 30</code> / <code>taikotrend 体力</code> / <code>taikotrend -b</code></p>
        <el-form label-position="top" @submit.prevent="submit">
          <el-form-item label="显示点数 N（1-50）">
            <el-input-number v-model="n" :min="1" :max="50" controls-position="right" />
          </el-form-item>
          <el-form-item label="最大天数（1-365）">
            <el-input-number v-model="maxDays" :min="1" :max="365" controls-position="right" />
          </el-form-item>
          <el-form-item label="维度（可选）">
            <el-select v-model="dim" clearable placeholder="默认显示全部维度">
              <el-option label="综合" value="综合" />
              <el-option label="大歌力" value="大歌力" />
              <el-option label="体力" value="体力" />
              <el-option label="高速处理" value="高速" />
              <el-option label="精度力" value="精度" />
              <el-option label="节奏处理" value="节奏" />
              <el-option label="复合处理" value="复合" />
            </el-select>
          </el-form-item>
          <el-form-item label="柱状图模式">
            <el-switch v-model="barMode" />
          </el-form-item>
          <el-form-item label="显示全部点">
            <el-switch v-model="showAll" />
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
          <img :src="imageUrl" alt="Rating 走势图" class="chart-image" />
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
