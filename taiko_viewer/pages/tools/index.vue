<script setup lang="ts">
import { buildPageDescription } from "~/utils/seo";

const pageMeta = {
  title: "查谱工具",
  desc: buildPageDescription("太鼓达人查谱工具箱：查配置、查物量、B30、Rating 走势与词云。")
};

definePageMeta({
  pageTitle: pageMeta.title,
  pageDesc: pageMeta.desc,
  navKey: "/tools",
  breadcrumbs: [{ label: "查谱工具", to: "/tools" }]
});

useViewerSeo({
  title: pageMeta.title,
  description: pageMeta.desc,
  path: "/tools",
  keywords: ["查谱工具", "查配置", "查物量", "taikob", "taikotrend"]
});

const tools = [
  {
    title: "查配置",
    desc: "按 BPM、难度或谱面配置检索歌曲",
    to: "/tools/chart-config",
    tag: "公开"
  },
  {
    title: "查物量",
    desc: "按音符总数查找对应谱面",
    to: "/tools/note-count",
    tag: "公开"
  },
  {
    title: "B30 表",
    desc: "生成 Rating Top N 汇总图（taikob）",
    to: "/tools/b30",
    tag: "需登录"
  },
  {
    title: "Rating 走势",
    desc: "查看各维度 Rating 历史曲线（taikotrend）",
    to: "/tools/trend",
    tag: "需登录"
  },
  {
    title: "太鼓词云",
    desc: "根据游玩记录生成词云（taikocloud）",
    to: "/tools/word-cloud",
    tag: "需登录"
  }
];
</script>

<template>
  <div class="page-stack">
    <el-card class="panel-card">
      <p class="intro">
        以下工具与 QQ 机器人指令能力一致，可在网页端独立使用。公开工具无需登录；图表类工具需绑定鼓众 ID 并完成数据同步。
      </p>
      <div class="tool-grid">
        <NuxtLink v-for="tool in tools" :key="tool.to" :to="tool.to" class="tool-card">
          <div class="tool-card__head">
            <h3>{{ tool.title }}</h3>
            <el-tag size="small" effect="plain">{{ tool.tag }}</el-tag>
          </div>
          <p>{{ tool.desc }}</p>
        </NuxtLink>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.page-stack {
  display: grid;
  gap: 20px;
}

.intro {
  margin: 0 0 16px;
  color: #6c5a4b;
  line-height: 1.6;
}

.tool-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}

.tool-card {
  display: block;
  padding: 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(196, 127, 79, 0.2);
  text-decoration: none;
  color: inherit;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.tool-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 24px rgba(165, 138, 110, 0.16);
}

.tool-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.tool-card h3 {
  margin: 0;
  font-size: 16px;
}

.tool-card p {
  margin: 0;
  font-size: 13px;
  color: #7a6552;
  line-height: 1.5;
}
</style>
