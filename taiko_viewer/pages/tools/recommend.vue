<script setup lang="ts">
import { computed, ref } from "vue";
import { buildPageDescription } from "~/utils/seo";
import { viewerErrorAlertType } from "~/utils/viewerError";
import type { TargetRecommendationKey, TargetRecommendationsPayload } from "~/types/recommendation-intelligence";

const { t, locale } = useI18n();
const localePath = useLocalePath();
definePageMeta({
  pageTitleKey: "tools.recommend",
  pageDescKey: "page.tools.recommend.desc",
  navKey: "/tools/recommend",
  breadcrumbs: [{ labelKey: "tools.title", to: "/tools" }, { labelKey: "tools.recommend", to: "/tools/recommend" }]
});
useViewerSeo(() => ({ title: t("tools.recommend"), description: buildPageDescription(t("page.tools.recommend.desc")), path: "/tools/recommend" }));

const mode = ref<"ordinary" | "target">("ordinary");
const n = ref(20);
const dim = ref("");
const target = ref<TargetRecommendationKey>("goku");
const star = ref("");
const { imageUrl, loading, errorMessage, loadChart } = useToolChartImage();
const targetData = ref<TargetRecommendationsPayload | null>(null);
const targetLoading = ref(false);
const targetError = ref("");
const copy = computed(() => locale.value === "ja" ? {
  hint: "通常推薦と目標推薦を選択できます。",
  ordinary: "通常推薦", target: "目標推薦", count: "推薦数（1-50）", dim: "指標（任意）", placeholder: "空欄なら総合 Rating", submit: "画像を生成", imageAlt: "おすすめ楽曲",
  targetType: "目標", star: "星級（任意）", allStars: "すべて", runTarget: "目標候補を表示", current: "現在", targetScore: "目標", gap: "差", progress: "進捗", index: "目標推薦指数", unplayed: "未プレイ", empty: "条件に合う候補がありません", insufficient: "候補数が少ないため、表示できる結果が限られています"
} : {
  hint: "可分别查看普通推荐与目标推荐。",
  ordinary: "普通推荐", target: "目标推荐", count: "推荐数量（1-50）", dim: "维度（可选）", placeholder: "留空为综合 Rating", submit: "生成推荐图", imageAlt: "推荐歌曲",
  targetType: "目标", star: "星级（可选）", allStars: "全部", runTarget: "查看目标候选", current: "当前", targetScore: "目标", gap: "差距", progress: "进度", index: "目标推荐指数", unplayed: "未游玩", empty: "没有符合条件的候选歌曲", insufficient: "候选数量不足，当前结果可能有限"
});
const targetOptions = computed(() => locale.value === "ja" ? [
  { value: "goku", label: "極" }, { value: "ziya", label: "紫雅" }, { value: "fenya", label: "粉雅" }, { value: "jinya", label: "金雅" }, { value: "full_combo", label: "フルコンボ" }, { value: "dondaful", label: "全良" }
] : [
  { value: "goku", label: "极" }, { value: "ziya", label: "紫雅" }, { value: "fenya", label: "粉雅" }, { value: "jinya", label: "金雅" }, { value: "full_combo", label: "全连" }, { value: "dondaful", label: "全良" }
]);
const stars = Array.from({ length: 10 }, (_, i) => String(i + 1));
const targetLabel = computed(() => targetOptions.value.find((item) => item.value === target.value)?.label || target.value);

const submitOrdinary = async () => loadChart("/api/account/charts/recommend", { n: n.value, dim: dim.value || undefined });
const submitTarget = async () => {
  targetLoading.value = true;
  targetError.value = "";
  targetData.value = null;
  try {
    targetData.value = await $fetch<TargetRecommendationsPayload>("/api/account/recommendation/target", { query: { target: target.value, ...(star.value ? { star: star.value } : {}) } });
  } catch (error) {
    targetError.value = error instanceof Error ? error.message : t("home.personal.recommendationUnavailable");
  } finally { targetLoading.value = false; }
};
const formatGap = (item: TargetRecommendationsPayload["items"][number]) => {
  if (item.gapKind === "unplayed") return copy.value.unplayed;
  if (item.gapValue === null) return "—";
  if (item.gapKind === "score") return `${item.gapValue.toLocaleString()}`;
  return `${item.gapValue}`;
};
</script>

<template>
  <div class="page-stack">
    <AccountToolGate>
      <el-card class="panel-card recommendation-tool">
        <div class="tool-header">
          <div><p class="hint">{{ copy.hint }}</p><div class="mode-tabs" role="tablist">
            <button class="mode-tab" :class="{ active: mode === 'ordinary' }" role="tab" :aria-selected="mode === 'ordinary'" @click="mode = 'ordinary'">{{ copy.ordinary }}</button>
            <button class="mode-tab" :class="{ active: mode === 'target' }" role="tab" :aria-selected="mode === 'target'" @click="mode = 'target'">{{ copy.target }}</button>
          </div></div>
        </div>

        <div v-if="mode === 'ordinary'">
          <el-form label-position="top" @submit.prevent="submitOrdinary">
            <el-form-item :label="copy.count"><el-input-number v-model="n" :min="1" :max="50" controls-position="right" /></el-form-item>
            <el-form-item :label="copy.dim"><el-select v-model="dim" clearable :placeholder="copy.placeholder"><el-option v-for="option in (locale === 'ja' ? [{ label: '総合 Rating', value: '综合' }, { label: '大歌力', value: '大歌力' }, { label: '体力', value: '体力' }, { label: '高速処理', value: '高速处理' }, { label: '精度力', value: '精度力' }, { label: 'リズム処理', value: '节奏处理' }, { label: '複合処理', value: '复合处理' }] : [{ label: '综合 Rating', value: '综合' }, { label: '大歌力', value: '大歌力' }, { label: '体力', value: '体力' }, { label: '高速处理', value: '高速处理' }, { label: '精度力', value: '精度力' }, { label: '节奏处理', value: '节奏处理' }, { label: '复合处理', value: '复合处理' }])" :key="option.value" :label="option.label" :value="option.value" /></el-select></el-form-item>
            <el-button type="primary" :loading="loading" native-type="submit">{{ copy.submit }}</el-button>
          </el-form>
          <el-alert v-if="errorMessage" :title="errorMessage" :type="viewerErrorAlertType(errorMessage)" show-icon :closable="false" class="result-alert viewer-friendly-alert" />
          <div v-if="imageUrl" class="chart-wrap"><img :src="imageUrl" :alt="copy.imageAlt" class="chart-image" /></div>
        </div>

        <div v-else>
          <el-form label-position="top" @submit.prevent="submitTarget">
            <el-form-item :label="copy.targetType"><el-select v-model="target"><el-option v-for="option in targetOptions" :key="option.value" :label="option.label" :value="option.value" /></el-select></el-form-item>
            <el-form-item :label="copy.star"><el-select v-model="star" clearable :placeholder="copy.allStars"><el-option :label="copy.allStars" value="" /><el-option v-for="value in stars" :key="value" :label="`${value}★`" :value="value" /></el-select></el-form-item>
            <el-button type="primary" :loading="targetLoading" native-type="submit">{{ copy.runTarget }}</el-button>
          </el-form>
          <el-alert v-if="targetError" :title="targetError" type="error" show-icon :closable="false" class="result-alert" />
          <div v-if="targetLoading" class="target-loading" aria-busy="true"></div>
          <template v-else-if="targetData">
            <p v-if="!targetData.isEnough" class="result-note">{{ copy.insufficient }}</p>
            <div v-if="!targetData.items.length" class="empty-state">{{ copy.empty }}</div>
            <div v-else class="target-list">
              <article v-for="item in targetData.items" :key="`${item.songId}-${item.level}`" class="target-item">
                <NuxtLink :to="localePath(`/songs/${item.songId}`)" class="target-item__song">
                  <SongCoverImage :song-id="item.songId" :alt="item.title" sizes="64px" fit="contain" />
                  <span class="target-item__title">{{ item.title }}</span>
                </NuxtLink>
                <div class="target-item__meta"><span>{{ item.level }}★</span><span>{{ copy.index }} {{ item.targetRecommendationIndex.toFixed(1) }}</span></div>
                <div class="target-item__metrics"><span>{{ copy.current }} {{ item.currentScore === null ? copy.unplayed : item.currentScore.toLocaleString() }}</span><span>{{ copy.targetScore }} {{ item.targetScore === null ? targetLabel : item.targetScore.toLocaleString() }}</span><span>{{ copy.gap }} {{ formatGap(item) }}</span></div>
                <div class="progress-line"><span :style="{ width: `${Math.min(100, Math.max(0, item.progressPercent))}%` }"></span></div>
                <small>{{ copy.progress }} {{ item.progressPercent.toFixed(1) }}%</small>
              </article>
            </div>
          </template>
        </div>
      </el-card>
    </AccountToolGate>
  </div>
</template>

<style scoped>
.page-stack { display: grid; gap: 20px; }
.recommendation-tool { display: grid; gap: 22px; }
.hint { margin: 0 0 14px; color: #6c5a4b; }
.mode-tabs { display: flex; gap: 8px; flex-wrap: wrap; }
.mode-tab { min-height: 44px; padding: 0 16px; border: 1px solid var(--viewer-border, #dfd1c4); border-radius: 10px; background: transparent; color: inherit; font-weight: 800; cursor: pointer; }
.mode-tab.active { border-color: #b84d37; background: #b84d37; color: #fff; }
.mode-tab:focus-visible { outline: 3px solid #d18366; outline-offset: 2px; }
.result-alert { margin-top: 16px; }
.chart-wrap { margin-top: 16px; text-align: center; }
.chart-image { max-width: 100%; border-radius: 12px; box-shadow: 0 10px 24px rgba(46, 35, 26, 0.12); }
.target-list { display: grid; gap: 10px; margin-top: 20px; }
.target-item { display: grid; gap: 8px; padding: 14px; border: 1px solid var(--viewer-border, #dfd1c4); border-radius: 10px; }
.target-item__song { min-width: 0; display: grid; grid-template-columns: 64px minmax(0, 1fr); align-items: center; gap: 12px; color: inherit; text-decoration: none; }
.target-item__song :deep(img) { width: 64px; height: 64px; border-radius: 8px; object-fit: contain; }
.target-item__title { overflow-wrap: anywhere; font-weight: 800; }
.target-item__meta, .target-item__metrics { display: flex; flex-wrap: wrap; gap: 12px; color: var(--viewer-text-muted, #806b5c); font-size: 13px; }
.target-item__meta { color: #b84d37; font-weight: 800; }
.progress-line { height: 7px; overflow: hidden; border-radius: 99px; background: rgba(184, 77, 55, 0.14); }
.progress-line span { display: block; height: 100%; border-radius: inherit; background: #b84d37; }
.target-item small { color: var(--viewer-text-muted, #806b5c); }
.target-loading { min-height: 180px; margin-top: 20px; border-radius: 10px; background: linear-gradient(90deg, rgba(184,77,55,.08), rgba(184,77,55,.2), rgba(184,77,55,.08)); animation: pulse 1.4s ease-in-out infinite; }
.empty-state, .result-note { margin-top: 18px; color: var(--viewer-text-muted, #806b5c); }
@keyframes pulse { 50% { opacity: .45; } }
:global(body.theme-dark) .hint { color: #c6b3a5; }
@media (max-width: 640px) { .target-item { padding: 12px; } .target-item__metrics { display: grid; gap: 4px; } }
</style>
