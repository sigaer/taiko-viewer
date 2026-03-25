<script setup lang="ts">
import { GUIDE_DIFFICULTY_OPTIONS } from "~/utils/guide";

const route = useRoute();
const difficulty = Number(route.query.difficulty || 0);
const level = Number(route.query.level || 0);

if (Number.isInteger(difficulty) && difficulty > 0 && Number.isInteger(level) && level > 0) {
  await navigateTo(`/guide/${difficulty}/${level}`, { redirectCode: 301 });
}

const pageMeta = {
  title: "谱面攻略",
  desc: "按难度与星级浏览国行谱面攻略入口。"
};

definePageMeta({
  pageTitle: pageMeta.title,
  pageDesc: pageMeta.desc,
  navKey: "/guide",
  breadcrumbs: [{ label: "谱面攻略", to: "/guide" }]
});

useViewerSeo({
  title: pageMeta.title,
  description: pageMeta.desc,
  path: "/guide",
  breadcrumbs: [
    { name: "首页", path: "/" },
    { name: "谱面攻略", path: "/guide" }
  ]
});
</script>

<template>
  <div class="guide-entry-page">
    <el-card class="panel-card guide-entry-hero">
      <div class="guide-entry-hero__copy">
        <span class="guide-entry-hero__eyebrow">Guide Hub</span>
        <h2>谱面攻略入口</h2>
        <p>按难度和定数进入对应攻略页，页面会输出独立 URL、canonical 与结构化 breadcrumb。</p>
      </div>
      <el-image src="/Makina.png" fit="contain" class="guide-entry-hero__image" />
    </el-card>

    <section class="guide-entry-grid">
      <el-card v-for="group in GUIDE_DIFFICULTY_OPTIONS" :key="group.value" class="panel-card guide-entry-card">
        <div class="guide-entry-card__head">
          <div class="guide-entry-card__title">
            <img :src="group.iconImage" :alt="group.label" class="guide-entry-card__icon" />
            <div>
              <h3>{{ group.label }}</h3>
              <p>{{ group.max }} 个星级入口</p>
            </div>
          </div>
        </div>
        <div class="guide-entry-card__links">
          <NuxtLink
            v-for="level in group.max"
            :key="`${group.value}-${level}`"
            class="guide-entry-link"
            :to="`/guide/${group.value}/${level}`"
          >
            {{ level }}星
          </NuxtLink>
        </div>
      </el-card>
    </section>
  </div>
</template>

<style scoped>
.guide-entry-page {
  display: grid;
  gap: 20px;
}

.guide-entry-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 180px;
  gap: 18px;
  align-items: center;
  overflow: hidden;
}

.guide-entry-hero__copy {
  display: grid;
  gap: 10px;
}

.guide-entry-hero__eyebrow {
  color: #b55a38;
  font-size: 12px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.guide-entry-hero__copy h2 {
  margin: 0;
  font-size: 32px;
}

.guide-entry-hero__copy p {
  margin: 0;
  color: #6e5947;
  line-height: 1.8;
}

.guide-entry-hero__image {
  width: 100%;
  max-width: 180px;
  justify-self: end;
}

.guide-entry-grid {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

.guide-entry-card {
  display: grid;
  gap: 14px;
}

.guide-entry-card__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.guide-entry-card__title {
  display: flex;
  gap: 12px;
  align-items: center;
}

.guide-entry-card__title h3 {
  margin: 0;
  font-size: 18px;
}

.guide-entry-card__title p {
  margin: 4px 0 0;
  color: #8d745e;
  font-size: 13px;
}

.guide-entry-card__icon {
  width: 42px;
  height: 42px;
  object-fit: contain;
}

.guide-entry-card__links {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.guide-entry-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 68px;
  padding: 9px 14px;
  border-radius: 999px;
  text-decoration: none;
  color: #6b4c34;
  background: linear-gradient(135deg, rgba(255, 228, 189, 0.9), rgba(255, 246, 232, 0.95));
  border: 1px solid rgba(185, 137, 95, 0.18);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.guide-entry-link:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 18px rgba(157, 115, 75, 0.12);
}

@media (max-width: 720px) {
  .guide-entry-hero {
    grid-template-columns: 1fr;
  }

  .guide-entry-hero__image {
    justify-self: start;
  }
}
</style>
