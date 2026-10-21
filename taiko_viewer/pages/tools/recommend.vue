<script setup lang="ts">
import AccountToolGate from "~/components/tools/AccountToolGate.vue";
import { computed, ref, watch, onBeforeUnmount } from "vue";
import { buildPageDescription } from "~/utils/seo";
import { difficultyLabelKey } from "~/utils/difficulty";
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
const includeImage = ref(false);
const { data: ordinaryData, loading, failed, load, invalidate } = useRecommendationTool();
watch([n,dim],invalidate);
const accountUser = useState<{id:number}|null>("account-user",()=>null);
const bindingGeneration = useState("account-binding-generation",()=>0);
let targetGeneration=0;
let targetController:AbortController|null=null;
const clearTarget=()=>{targetGeneration++;targetController?.abort();targetController=null;targetData.value=null;targetLoading.value=false;targetError.value="";};
const targetData = ref<TargetRecommendationsPayload | null>(null);
const targetLoading = ref(false);
const targetError = ref("");
const copy = computed(() => locale.value === "ja" ? {
  hint: "通常推薦と目標推薦を選択できます。",
  ordinary: "通常推薦", target: "目標推薦", count: "推薦数（1-50）", dim: "指標（任意）", placeholder: "空欄なら総合 Rating", submit: "推薦を表示", exportImage: "画像も生成", imageAlt: "おすすめ楽曲",
  targetType: "目標", star: "星級（任意）", allStars: "すべて", runTarget: "目標候補を表示", current: "現在", targetScore: "目標", gap: "差", progress: "進捗", index: "目標推薦指数", unplayed: "未プレイ", empty: "条件に合う候補がありません", insufficient: "候補数が少ないため、表示できる結果が限られています"
} : {
  hint: "可分别查看普通推荐与目标推荐。",
  ordinary: "普通推荐", target: "目标推荐", count: "推荐数量（1-50）", dim: "维度（可选）", placeholder: "留空为综合 Rating", submit: "查看推荐", exportImage: "同时生成图片", imageAlt: "推荐歌曲",
  targetType: "目标", star: "星级（可选）", allStars: "全部", runTarget: "查看目标候选", current: "当前", targetScore: "目标", gap: "差距", progress: "进度", index: "目标推荐指数", unplayed: "未游玩", empty: "没有符合条件的候选歌曲", insufficient: "候选数量不足，当前结果可能有限"
});
const targetOptions = computed(() => locale.value === "ja" ? [
  { value: "goku", label: "極" }, { value: "ziya", label: "紫雅" }, { value: "fenya", label: "粉雅" }, { value: "jinya", label: "金雅" }, { value: "full_combo", label: "フルコンボ" }, { value: "dondaful", label: "全良" }
] : [
  { value: "goku", label: "极" }, { value: "ziya", label: "紫雅" }, { value: "fenya", label: "粉雅" }, { value: "jinya", label: "金雅" }, { value: "full_combo", label: "全连" }, { value: "dondaful", label: "全良" }
]);
const stars = Array.from({ length: 10 }, (_, i) => String(i + 1));
const targetLabel = computed(() => targetOptions.value.find((item) => item.value === target.value)?.label || target.value);

watch(()=>[accountUser.value?.id,bindingGeneration.value],clearTarget,{flush:"sync"});
watch([target,star],clearTarget);
onBeforeUnmount(clearTarget);
const submitOrdinary = async () => load({ n: n.value, dim: dim.value, image: includeImage.value });
const submitTarget = async () => {
  clearTarget();const request=targetGeneration;targetController=new AbortController();
  targetLoading.value = true;
  targetError.value = "";
  targetData.value = null;
  try {
    const result = await $fetch<TargetRecommendationsPayload>("/api/account/recommendation/target", { signal:targetController.signal, query: { target: target.value, ...(star.value ? { star: star.value } : {}) } });
    if(request===targetGeneration)targetData.value=result;
  } catch (error) {
    if(request!==targetGeneration)return;
    targetError.value = error instanceof Error ? error.message : t("home.personal.recommendationUnavailable");
  } finally { if(request===targetGeneration){targetLoading.value = false;targetController=null;} }
};
const formatGap = (item: TargetRecommendationsPayload["items"][number]) => {
  if (item.gapKind === "unplayed") return copy.value.unplayed;
  if (item.gapValue === null) return "—";
  if (item.gapKind === "score") return `${item.gapValue.toLocaleString()}`;
  return `${item.gapValue}`;
};
const ordinarySummary = computed(() => `${dim.value || (locale.value === 'ja' ? '総合 Rating' : '综合 Rating')} · ${includeImage.value ? copy.value.exportImage : (locale.value === 'ja' ? 'リストのみ' : '仅列表')}`);
</script>

<template>
  <div class="page-stack">
    <AccountToolGate>
      <section class="recommendation-tool">
        <div class="tool-header">
          <div><div class="mode-tabs" role="tablist">
            <button class="mode-tab" :class="{ active: mode === 'ordinary' }" role="tab" :aria-selected="mode === 'ordinary'" @click="mode = 'ordinary'">{{ copy.ordinary }}</button>
            <button class="mode-tab" :class="{ active: mode === 'target' }" role="tab" :aria-selected="mode === 'target'" @click="mode = 'target'">{{ copy.target }}</button>
          </div></div>
        </div>

        <div v-if="mode === 'ordinary'">
          <el-form label-position="top" class="ordinary-form" @submit.prevent="submitOrdinary">
            <div class="recommend-primary-controls">
            <el-form-item :label="copy.count"><el-input-number v-model="n" :min="1" :max="50" controls-position="right" /></el-form-item>
              <el-button type="primary" :loading="loading" native-type="submit">{{ copy.submit }}</el-button>
            </div>
            <details class="recommend-advanced"><summary>{{ locale === 'ja' ? '推薦の条件' : '推荐设置' }}<span>{{ ordinarySummary }}</span></summary>
              <div class="advanced-fields">
            <el-form-item :label="copy.dim"><el-select v-model="dim" clearable :placeholder="copy.placeholder"><el-option v-for="option in (locale === 'ja' ? [{ label: '総合 Rating', value: '综合' }, { label: '大歌力', value: '大歌力' }, { label: '体力', value: '体力' }, { label: '高速処理', value: '高速处理' }, { label: '精度力', value: '精度力' }, { label: 'リズム処理', value: '节奏处理' }, { label: '複合処理', value: '复合处理' }] : [{ label: '综合 Rating', value: '综合' }, { label: '大歌力', value: '大歌力' }, { label: '体力', value: '体力' }, { label: '高速处理', value: '高速处理' }, { label: '精度力', value: '精度力' }, { label: '节奏处理', value: '节奏处理' }, { label: '复合处理', value: '复合处理' }])" :key="option.value" :label="option.label" :value="option.value" /></el-select></el-form-item>
            <el-form-item><el-checkbox v-model="includeImage">{{ copy.exportImage }}</el-checkbox></el-form-item>
              </div>
            </details>
          </el-form>
          <el-alert v-if="failed" :title="t('home.personal.recommendationUnavailable')" type="error" show-icon :closable="false" class="result-alert viewer-friendly-alert" />
          <template v-if="ordinaryData">
            <div v-if="!ordinaryData.items.length" class="empty-state">{{ copy.empty }}</div>
            <header v-if="ordinaryData.items.length" class="recommend-results-head"><h2>{{ locale === 'ja' ? 'おすすめ楽曲' : '推荐结果' }}</h2><span>{{ ordinaryData.items.length }}{{ locale === 'ja' ? '曲' : '首' }}</span></header>
            <div v-if="ordinaryData.items.length" class="target-list" data-testid="ordinary-list">
              <RecommendationSongItem v-for="item in ordinaryData.items" :key="`${item.songId}-${item.level}`"
                :song-id="item.songId" :title="item.title" :difficulty-type="item.level" :star-level="item.starLevel"
                :to="localePath({ path: `/songs/${item.songId}`, query: { difficulty: String(item.level), ...(item.canCreateGoal ? { recommendation: item.recommendationToken } : {}) } })">
                <template v-if="item.isUnplayed" #tags><span>{{ copy.unplayed }}</span></template>
                <template v-if="item.canCreateGoal" #actions><RecommendationGoalAction :token="item.recommendationToken" :song-id="item.songId" :difficulty-type="item.level" /></template>
              </RecommendationSongItem>
            </div>
            <div v-if="ordinaryData.image" class="chart-wrap"><img :src="ordinaryData.image" :alt="copy.imageAlt" class="chart-image" /></div>
          </template>
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
              <article v-for="item in targetData.items" :key="`${item.songId}-${item.level}`" class="target-item target-item--target">
                <NuxtLink :to="localePath({ path: `/songs/${item.songId}`, query: { difficulty: String(item.level) } })" class="target-item__song">
                  <SongCoverImage :song-id="item.songId" :alt="item.title" sizes="64px" fit="contain" />
                  <span class="target-item__title" lang="zh-CN">{{ item.title }}</span>
                </NuxtLink>
                <div class="target-item__meta"><span>{{ item.star }}★</span><span>{{ copy.index }} {{ item.targetRecommendationIndex.toFixed(1) }}</span></div>
                <div class="target-item__metrics"><span>{{ copy.current }} {{ item.currentScore === null ? copy.unplayed : item.currentScore.toLocaleString() }}</span><span>{{ copy.targetScore }} {{ item.targetScore === null ? targetLabel : item.targetScore.toLocaleString() }}</span><span>{{ copy.gap }} {{ formatGap(item) }}</span></div>
                <div class="progress-line"><span :style="{ width: `${Math.min(100, Math.max(0, item.progressPercent))}%` }"></span></div>
                <small>{{ copy.progress }} {{ item.progressPercent.toFixed(1) }}%</small>
              </article>
            </div>
          </template>
        </div>
      </section>
    </AccountToolGate>
  </div>
</template>

<style scoped>
.page-stack{display:grid;gap:32px;}.recommendation-tool{min-width:0;}.tool-header{margin-bottom:24px;}.mode-tabs{display:flex;gap:24px;border-bottom:1px solid var(--viewer-border);}.mode-tab{min-height:48px;padding:8px 0;border:0;border-bottom:3px solid transparent;background:transparent;color:var(--viewer-text-muted);font:inherit;cursor:pointer;}.mode-tab.active{color:var(--viewer-primary);border-bottom-color:var(--viewer-primary);font-weight:600;}.mode-tab:focus-visible{outline:3px solid var(--viewer-link);outline-offset:3px;}
.ordinary-form{margin-bottom:28px;}.recommend-primary-controls{display:flex;align-items:flex-end;gap:20px;}.recommend-primary-controls .el-form-item{margin:0;}.recommend-primary-controls>.el-button{margin-bottom:0;}.recommend-advanced{margin-top:12px;}.recommend-advanced summary{display:flex;align-items:center;flex-wrap:wrap;gap:4px 16px;min-height:48px;cursor:pointer;color:var(--viewer-link);font-size:14px;}.recommend-advanced summary::before{content:'+';font-size:18px;}.recommend-advanced[open] summary::before{content:'−';}.recommend-advanced summary span{color:var(--viewer-text-muted);}.advanced-fields{display:grid;grid-template-columns:minmax(200px,320px) auto;align-items:end;gap:12px 24px;padding:16px 0 4px;}.advanced-fields .el-form-item{margin:0;}
.recommend-results-head{display:flex;gap:16px;align-items:baseline;margin:0 0 8px;}.recommend-results-head h2{font-size:20px;font-weight:600;margin:0;}.recommend-results-head>span{font-size:14px;color:var(--viewer-text-muted);}.target-list{display:grid;gap:0;}.target-item{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:16px;padding:18px 0;border-bottom:1px solid var(--viewer-border);min-width:0;}.target-item__song{min-width:0;display:grid;grid-template-columns:56px minmax(0,1fr);align-items:center;gap:14px;color:var(--viewer-text);text-decoration:none;}.target-item__song :deep(.song-cover-picture){width:56px;height:56px;border-radius:7px;overflow:hidden;}.target-item__text{display:grid;gap:6px;min-width:0;}.target-item__title{overflow-wrap:anywhere;font-weight:600;font-size:16px;line-height:1.5;}.target-item__meta,.target-item__metrics{display:flex;flex-wrap:wrap;gap:6px 12px;font-size:14px;line-height:1.5;color:var(--viewer-text-muted);}.target-item :deep(.recommendation-goal-action>button){font-size:14px;padding:8px 12px;border-color:var(--viewer-border);color:var(--viewer-link);background:var(--viewer-surface);white-space:nowrap;}.target-item--target{grid-template-columns:minmax(0,1fr);}.result-alert{margin-top:16px;}.chart-wrap{margin-top:28px;}.chart-image{display:block;max-width:100%;height:auto;}.empty-state,.result-note{margin-top:20px;font-size:15px;color:var(--viewer-text-muted);}.target-loading{min-height:120px;background:var(--viewer-surface-subtle);}.progress-line{height:6px;background:var(--viewer-surface-subtle);border-radius:6px;overflow:hidden;}.progress-line span{height:100%;display:block;background:var(--viewer-primary);}.target-item small{color:var(--viewer-text-muted);font-size:14px;}
@media(max-width:640px){.advanced-fields{grid-template-columns:minmax(0,1fr);}.target-item{gap:12px;}.target-item__song{gap:12px;}.recommend-primary-controls{justify-content:space-between;gap:16px;}}
</style>
