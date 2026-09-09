<script setup lang="ts">
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import AnnualArtworkFallback from "../AnnualArtworkFallback.vue";
import AnnualScene from "../AnnualScene.vue";
import { useAnnualTimeline } from "~/composables/useAnnualTimeline";
import { computed, ref, toRef } from "vue";

const props = defineProps<{ summary: VersionSummaryViewModel; pageIndex: number; pageTotal: number; active: boolean; reducedMotion: boolean }>();
const { n, t } = useI18n();
const sceneRef = ref<{ rootEl?: HTMLElement | null } | null>(null);
useAnnualTimeline(sceneRef, toRef(props, "active"), toRef(props, "reducedMotion"), { reenter: "final" });
const milestoneOrder = ["clear", "full_combo", "dondaful"];
const orderedMilestones = computed(() => milestoneOrder.flatMap((type) => props.summary.milestones.filter((item) => item.type === type)));
</script>

<template>
  <AnnualScene ref="sceneRef" class="milestones-scene" :active="active" :reduced-motion="reducedMotion" mood="award-purple" intensity="medium">
    <template #background><div class="milestones-scene__background"><img src="/annual/milestones/background.png" alt="" aria-hidden="true"><i class="milestones-scene__shimmer" /></div></template>
    <div class="milestones-poster">
      <h1 data-annual-stage="title">{{ summary.copy.milestones.title }}</h1>
      <div class="milestones-list" :class="`milestones-list--${Math.min(orderedMilestones.length, 3)}`">
        <article v-for="(item, index) in orderedMilestones" :key="`${item.type}-${item.song.songNo}-${item.level}`" class="milestone-event" :style="{ '--index': index }" data-animate>
          <div class="milestone-event__cover"><el-image :src="item.song.coverUrl" fit="cover"><template #error><AnnualArtworkFallback :label="t('annualSummary.common.defaultCover')" /></template></el-image><i class="milestone-event__sweep" /></div>
          <div class="milestone-event__copy"><b>{{ t(`annualSummary.milestoneTypeLabels.${item.type}`) }}</b><strong>{{ item.song.name }}</strong><span>{{ item.happenedLabel }}</span><small>{{ t('annualSummary.slides.milestones.effort', { plays: n(item.playCount), stars: item.song.stars ?? '—' }) }}</small></div>
        </article>
      </div>
    </div>
  </AnnualScene>
</template>

<style scoped>
.milestones-scene{background:#69b7ed}.milestones-scene__background{position:absolute;inset:0;overflow:hidden;background:#69b7ed}.milestones-scene__background img{width:100%;height:100%;object-fit:cover}.milestones-scene__shimmer{position:absolute;right:25%;top:-15%;width:7%;height:130%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.32),transparent);filter:blur(4px);opacity:0}.milestones-poster{position:absolute;inset:0;padding:5.5% 0 4%;color:#fff}.milestones-poster h1{position:relative;z-index:1;margin:0 0 0 10%;color:#fff;font:700 clamp(2rem,8.8vw,3.6rem)/1 var(--viewer-display-font);letter-spacing:.04em;text-shadow:3px 5px 0 rgba(42,104,170,.45),0 8px 18px rgba(24,75,135,.45)}.milestones-list{position:absolute;left:0;top:16.5%;width:59%;height:73%;display:grid;align-content:space-between;padding:0 0 1% 8%;}.milestone-event{display:grid;justify-items:center;width:190px;opacity:0;transform:translateY(6px)}.annual-scene.is-active .milestone-event{animation:milestone-event-in .5s calc(.3s + var(--index)*.22s) ease-out forwards}.milestone-event__cover{position:relative;width:112px;height:112px;border:6px solid rgba(255,255,255,.96);border-radius:14px;overflow:hidden;box-shadow:8px 9px 16px rgba(31,77,140,.3);background:rgba(255,255,255,.2)}.milestone-event__cover :deep(.el-image){width:100%;height:100%}.milestone-event__copy{width:190px;margin-top:8px;text-align:center;text-shadow:1px 2px 9px rgba(28,85,145,.4)}.milestone-event__copy b,.milestone-event__copy strong,.milestone-event__copy span,.milestone-event__copy small{display:block;color:#fff}.milestone-event__copy b{margin-bottom:4px;font:800 13px/1 var(--viewer-font-family);letter-spacing:.13em;text-shadow:1px 2px 8px rgba(28,85,145,.55)}.milestone-event__copy strong{font:700 16px/1.18 var(--viewer-display-font);display:-webkit-box;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:2}.milestone-event__copy span{margin-top:4px;font:700 14px/1.1 var(--viewer-font-family)}.milestone-event__copy small{margin-top:4px;font:700 14px/1.1 var(--viewer-font-family)}.milestone-event__sweep{position:absolute;inset:-30% auto -30% -90%;width:34%;background:linear-gradient(105deg,transparent,rgba(255,255,255,.78),transparent);transform:rotate(12deg);opacity:0}.annual-scene.is-active .milestone-event:nth-child(1) .milestone-event__sweep{animation:milestone-sweep .65s 1s ease-out forwards}.annual-scene.is-active .milestone-event:nth-child(2) .milestone-event__sweep{animation:milestone-sweep .65s 1.22s ease-out forwards}.annual-scene.is-active .milestone-event:nth-child(3) .milestone-event__sweep{animation:milestone-sweep .65s 1.44s ease-out forwards}.annual-scene.is-active .milestones-scene__shimmer{animation:milestone-shimmer 3.2s .35s ease-out forwards}.annual-scene.is-reduced .milestone-event{opacity:1;transform:none}.annual-scene.is-reduced .milestones-scene__shimmer,.annual-scene.is-reduced .milestone-event__sweep{display:none}@keyframes milestone-event-in{to{opacity:1;transform:none}}@keyframes milestone-sweep{0%{left:-90%;opacity:0}20%{opacity:.75}100%{left:150%;opacity:0}}@keyframes milestone-shimmer{0%{opacity:0;transform:translateX(-180%)}15%{opacity:.35}100%{opacity:0;transform:translateX(620%)}}@media(max-width:720px){.milestones-poster{padding-top:6%}.milestones-poster h1{margin-left:10%;font-size:clamp(2rem,9vw,3.1rem)}.milestones-list{top:14%;width:60%;height:82%;padding-left:4%}.milestone-event{width:150px}.milestone-event__cover{width:108px;height:108px}.milestone-event__copy{width:160px}.milestone-event__copy strong{font-size:14px}.milestone-event__copy span,.milestone-event__copy small{font-size:12px}}@media(max-height:680px){.milestones-list{top:15%;height:80%}.milestone-event__cover{width:88px;height:88px;border-width:5px}.milestone-event__copy{margin-top:5px}.milestone-event__copy strong{font-size:12px}.milestone-event__copy span,.milestone-event__copy small{font-size:11px}}
</style>
