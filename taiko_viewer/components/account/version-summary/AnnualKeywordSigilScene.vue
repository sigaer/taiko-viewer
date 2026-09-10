<script setup lang="ts">
import { computed, ref, toRef } from "vue";
import AnnualKeywordRadarSigil, { type AnnualKeywordRadarEntry } from "./AnnualKeywordRadarSigil.vue";
import AnnualScene from "./AnnualScene.vue";
import { useAnnualTimeline } from "~/composables/useAnnualTimeline";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import { isUsableMetric } from "~/utils/annualPresentation";

const props = defineProps<{
  summary: VersionSummaryViewModel;
  active: boolean;
  reducedMotion: boolean;
}>();

const { t } = useI18n();
const rootRef = ref<InstanceType<typeof AnnualScene> | null>(null);
const saveData = ref(process.client && Boolean(
  (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
));
const motionReduced = computed(() => props.reducedMotion || saveData.value);
useAnnualTimeline(rootRef, toRef(props, "active"), motionReduced, { reenter: "restart" });

const dimensionOrder = ["big_song", "stamina", "speed", "accuracy", "rhythm", "complex"] as const;
// Cached summaries key the radar by the annual dimension names, while the
// shared recommendation model exposes the same dimensions as `accuracy_power`
// and `complex_proc`. Accept either spelling so a producer change cannot
// silently drop two axes.
const dimensionAliases: Record<(typeof dimensionOrder)[number], readonly string[]> = {
  big_song: ["big_song"],
  stamina: ["stamina"],
  speed: ["speed"],
  accuracy: ["accuracy", "accuracy_power"],
  rhythm: ["rhythm"],
  complex: ["complex", "complex_proc"]
};
const profileKeyword = computed(() => props.summary.keywordProfile || props.summary.keyword);
const cleanText = (value: unknown, fallback = "") => {
  const text = typeof value === "string" ? value.trim() : "";
  return text && text !== "undefined" && text !== "null" && !/^annualSummary\./.test(text) ? text : fallback;
};
const radarEntries = computed<AnnualKeywordRadarEntry[]>(() => dimensionOrder.map((key) => {
  const values = profileKeyword.value?.radarValues || {};
  const source = dimensionAliases[key].map((alias) => Number(values[alias])).find((value) => isUsableMetric(value));
  return {
    key,
    label: cleanText(t(`annualSummary.keywords.dimensions.${key}`), key),
    value: source ?? Number.NaN
  };
}).filter((entry) => isUsableMetric(entry.value)));
const rankedEntries = computed(() => [...radarEntries.value].sort((left, right) => right.value - left.value));
const topEntries = computed(() => rankedEntries.value.slice(0, 3));
// The six dimensions share one documented scale, so the sigil uses that fixed
// scale instead of each account's own maximum. A self-scaled radar would push
// every account's peak onto the outer ring and would also make a slightly
// higher dimension draw a shorter spike.
const ANNUAL_KEYWORD_RADAR_MAX = 15.5;
const radarMax = computed(() => {
  const maximum = Math.max(...radarEntries.value.map((entry) => entry.value), 0);
  return Math.max(ANNUAL_KEYWORD_RADAR_MAX, Math.ceil(maximum));
});
const highlightKey = computed(() => {
  const supplied = cleanText(profileKeyword.value?.dimensionKey);
  return radarEntries.value.some((entry) => entry.key === supplied) ? supplied : rankedEntries.value[0]?.key || "";
});
const keywordTitle = computed(() => cleanText(
  profileKeyword.value?.title,
  cleanText(props.summary.finalTitle.title, "鼓面关键词")
));
const dimensionLabel = computed(() => cleanText(
  profileKeyword.value?.dimensionLabel,
  rankedEntries.value[0]?.label || ""
));
const body = computed(() => cleanText(
  profileKeyword.value?.body,
  cleanText(props.summary.copy.keyword.body)
));
</script>

<template>
  <AnnualScene
    ref="rootRef"
    class="annual-keyword-sigil-scene"
    :class="{ 'is-static': motionReduced }"
    :active="active"
    :reduced-motion="motionReduced"
    mood="keyword-sigil"
    intensity="high"
    data-visual-style="keyword-drum-sigil"
  >
    <template #background>
      <div class="annual-keyword-sigil-scene__backdrop"></div>
      <div class="annual-keyword-sigil-scene__halo"></div>
    </template>

    <template #atmosphere>
      <div class="annual-keyword-sigil-scene__orbit annual-keyword-sigil-scene__orbit--outer"></div>
      <div class="annual-keyword-sigil-scene__orbit annual-keyword-sigil-scene__orbit--inner"></div>
      <div class="annual-keyword-sigil-scene__stars">
        <i v-for="index in 12" :key="index"></i>
      </div>
    </template>

    <div class="annual-keyword-sigil-scene__content">
      <header class="annual-keyword-sigil-scene__header">
        <p class="annual-keyword-sigil-scene__eyebrow" data-annual-stage="title">{{ t("annualSummary.keywords.eyebrow") }}</p>
        <h2 class="annual-keyword-sigil-scene__title" data-annual-stage="title">{{ keywordTitle }}</h2>
        <p class="annual-keyword-sigil-scene__lead" data-annual-stage="copy">{{ t("annualSummary.keywords.lead") }}</p>
      </header>

      <div class="annual-keyword-sigil-scene__sigil-wrap" :class="{ 'is-empty': radarEntries.length < 3 }">
        <AnnualKeywordRadarSigil
          v-if="radarEntries.length >= 3"
          :entries="radarEntries"
          :max-value="radarMax"
          :highlight-key="highlightKey"
          :active="active"
          :reduced-motion="reducedMotion"
          :save-data="saveData"
        />
        <div v-else class="annual-keyword-sigil-scene__empty-sigil" aria-hidden="true">
          <span></span><i></i>
        </div>

        <ol v-if="topEntries.length" class="annual-keyword-sigil-scene__tags" :aria-label="t('annualSummary.keywords.tagsLabel')">
          <li
            v-for="(entry, index) in topEntries"
            :key="entry.key"
            :class="`is-rank-${index + 1}`"
            data-annual-stage="data"
          >
            <small>0{{ index + 1 }}</small><span>{{ entry.label }}</span>
          </li>
        </ol>
      </div>

      <div v-if="dimensionLabel" class="annual-keyword-sigil-scene__beacon" data-annual-stage="data">
        <span>{{ t("annualSummary.keywords.beaconPrefix") }}</span>
        <strong>{{ dimensionLabel }}</strong>
      </div>

      <p v-if="body" class="annual-keyword-sigil-scene__body" data-annual-stage="copy">{{ body }}</p>
      <p class="annual-keyword-sigil-scene__closing" data-annual-stage="copy">{{ t("annualSummary.keywords.closing") }}</p>
    </div>
  </AnnualScene>
</template>

<style scoped>
.annual-keyword-sigil-scene{--sigil-night:#020b1b;--sigil-blue:#0a2440;--sigil-cyan:#65e8df;--sigil-gold:#f1d28a;position:relative;width:100%;height:100vh;height:100svh;height:100dvh;overflow:hidden;color:#eefbf8;background:var(--sigil-night)}
.annual-keyword-sigil-scene__backdrop{position:absolute;inset:0;background:radial-gradient(circle at 50% 45%,rgba(25,120,141,.44) 0,rgba(7,38,68,.42) 28%,transparent 58%),linear-gradient(168deg,#082a49 0,#04162d 43%,#020817 100%)}
.annual-keyword-sigil-scene__backdrop::before{content:"";position:absolute;inset:0;background:linear-gradient(118deg,transparent 18%,rgba(99,227,218,.055) 48%,transparent 72%),radial-gradient(circle at 18% 17%,rgba(55,126,184,.18),transparent 25%);mix-blend-mode:screen}
.annual-keyword-sigil-scene__halo{position:absolute;left:50%;top:45%;width:min(120vw,600px);aspect-ratio:1;border-radius:50%;background:radial-gradient(circle,rgba(52,222,208,.19),rgba(25,104,144,.08) 42%,transparent 68%);transform:translate(-50%,-50%);opacity:.9}
.annual-keyword-sigil-scene__orbit{position:absolute;left:50%;top:46%;aspect-ratio:1;border-radius:50%;transform:translate(-50%,-50%);border:1px solid rgba(122,238,230,.16)}
.annual-keyword-sigil-scene__orbit::before,.annual-keyword-sigil-scene__orbit::after{content:"";position:absolute;width:5px;height:5px;border-radius:50%;background:var(--sigil-gold);box-shadow:0 0 12px rgba(241,210,138,.8)}
.annual-keyword-sigil-scene__orbit::before{left:12%;top:20%}.annual-keyword-sigil-scene__orbit::after{right:7%;bottom:27%}.annual-keyword-sigil-scene__orbit--outer{width:min(132vw,650px);border-style:dashed}.annual-keyword-sigil-scene__orbit--inner{width:min(101vw,500px);border-color:rgba(101,232,223,.11)}
.annual-keyword-sigil-scene__stars{position:absolute;inset:0}.annual-keyword-sigil-scene__stars i{position:absolute;width:2px;height:2px;border-radius:50%;background:#b5fff8;box-shadow:0 0 6px rgba(181,255,248,.9);opacity:.46}.annual-keyword-sigil-scene__stars i:nth-child(1){left:9%;top:16%}.annual-keyword-sigil-scene__stars i:nth-child(2){left:18%;top:35%}.annual-keyword-sigil-scene__stars i:nth-child(3){left:7%;top:63%}.annual-keyword-sigil-scene__stars i:nth-child(4){left:23%;top:79%}.annual-keyword-sigil-scene__stars i:nth-child(5){left:39%;top:23%}.annual-keyword-sigil-scene__stars i:nth-child(6){left:47%;top:72%}.annual-keyword-sigil-scene__stars i:nth-child(7){right:9%;top:20%}.annual-keyword-sigil-scene__stars i:nth-child(8){right:18%;top:37%}.annual-keyword-sigil-scene__stars i:nth-child(9){right:6%;top:58%}.annual-keyword-sigil-scene__stars i:nth-child(10){right:22%;top:78%}.annual-keyword-sigil-scene__stars i:nth-child(11){right:39%;top:13%}.annual-keyword-sigil-scene__stars i:nth-child(12){right:42%;top:87%}
.annual-keyword-sigil-scene__content{position:relative;width:min(100%,520px);height:100%;margin:0 auto;padding:max(58px,calc(env(safe-area-inset-top) + 48px)) max(16px,env(safe-area-inset-right)) max(72px,calc(env(safe-area-inset-bottom) + 64px)) max(16px,env(safe-area-inset-left));box-sizing:border-box}.annual-keyword-sigil-scene__header{position:relative;z-index:4;display:grid;justify-items:center;text-align:center}.annual-keyword-sigil-scene__eyebrow{display:flex;align-items:center;gap:10px;margin:0;color:#8eece4;font-size:clamp(11px,2.8vw,13px);font-weight:700;letter-spacing:.32em}.annual-keyword-sigil-scene__eyebrow::before,.annual-keyword-sigil-scene__eyebrow::after{content:"";width:26px;height:1px;background:linear-gradient(90deg,transparent,var(--sigil-cyan))}.annual-keyword-sigil-scene__eyebrow::after{transform:scaleX(-1)}
.annual-keyword-sigil-scene__title{max-width:12ch;margin:11px 0 0;color:#fff8e8;font:900 clamp(2.45rem,10vw,4rem)/1.02 var(--viewer-display-font);letter-spacing:.015em;text-wrap:balance;overflow-wrap:anywhere;text-shadow:0 0 20px rgba(80,220,210,.3),0 5px 18px rgba(0,0,0,.42)}.annual-keyword-sigil-scene__lead{margin:9px 0 0;color:#afcbd4;font-size:clamp(12px,3.3vw,15px);line-height:1.5;letter-spacing:.04em}
.annual-keyword-sigil-scene__sigil-wrap{position:absolute;z-index:2;left:50%;top:clamp(202px,24vh,232px);width:min(calc(100vw - 18px),430px);aspect-ratio:1;transform:translateX(-50%)}.annual-keyword-sigil-scene__sigil-wrap.is-empty{opacity:.62}.annual-keyword-sigil-scene__empty-sigil{position:absolute;inset:15%;border:1px dashed rgba(109,229,221,.46);border-radius:50%;box-shadow:inset 0 0 60px rgba(41,166,174,.12),0 0 38px rgba(41,166,174,.1)}.annual-keyword-sigil-scene__empty-sigil::before,.annual-keyword-sigil-scene__empty-sigil::after,.annual-keyword-sigil-scene__empty-sigil span{content:"";position:absolute;left:50%;top:50%;width:68%;height:1px;background:linear-gradient(90deg,transparent,rgba(105,229,221,.35),transparent)}.annual-keyword-sigil-scene__empty-sigil::before{transform:translate(-50%,-50%) rotate(60deg)}.annual-keyword-sigil-scene__empty-sigil::after{transform:translate(-50%,-50%) rotate(-60deg)}.annual-keyword-sigil-scene__empty-sigil span{transform:translate(-50%,-50%)}.annual-keyword-sigil-scene__empty-sigil i{position:absolute;left:50%;top:50%;width:10px;height:10px;border:2px solid var(--sigil-gold);border-radius:50%;transform:translate(-50%,-50%);box-shadow:0 0 18px rgba(241,210,138,.62)}
.annual-keyword-sigil-scene__tags{position:absolute;inset:0;margin:0;padding:0;list-style:none;pointer-events:none}.annual-keyword-sigil-scene__tags li{position:absolute;display:flex;align-items:center;gap:6px;max-width:32%;min-height:28px;padding:6px 10px;border:1px solid rgba(100,232,223,.26);border-radius:4px 12px 4px 12px;color:#c7f9f3;background:linear-gradient(105deg,rgba(8,37,61,.88),rgba(7,26,48,.54));box-shadow:0 8px 22px rgba(0,7,21,.28),inset 0 0 14px rgba(74,220,213,.04);font-size:clamp(10px,2.8vw,12px);line-height:1.15;white-space:nowrap}.annual-keyword-sigil-scene__tags li::after{content:"";position:absolute;width:20px;height:1px;background:linear-gradient(90deg,rgba(100,232,223,.52),transparent)}.annual-keyword-sigil-scene__tags small{color:#67b9bc;font:600 9px/1 ui-monospace,SFMono-Regular,Consolas,monospace}.annual-keyword-sigil-scene__tags span{overflow:hidden;text-overflow:ellipsis}.annual-keyword-sigil-scene__tags .is-rank-1{right:0;top:17%;color:#fff0bd;border-color:rgba(241,210,138,.48);box-shadow:0 0 20px rgba(241,210,138,.1),0 8px 22px rgba(0,7,21,.3)}.annual-keyword-sigil-scene__tags .is-rank-1::after{right:100%;top:50%;background:linear-gradient(90deg,transparent,rgba(241,210,138,.62))}.annual-keyword-sigil-scene__tags .is-rank-1 small{color:#e5c879}.annual-keyword-sigil-scene__tags .is-rank-2{left:0;top:48%}.annual-keyword-sigil-scene__tags .is-rank-2::after{left:100%;top:50%}.annual-keyword-sigil-scene__tags .is-rank-3{right:3%;bottom:16%}.annual-keyword-sigil-scene__tags .is-rank-3::after{right:100%;top:50%;transform:scaleX(-1)}
.annual-keyword-sigil-scene__beacon{position:absolute;z-index:4;left:50%;bottom:clamp(202px,24.5vh,232px);display:grid;grid-template-columns:auto auto;align-items:baseline;gap:5px 8px;width:max-content;max-width:calc(100% - 48px);padding:9px 17px 10px;border:1px solid rgba(240,209,137,.38);border-radius:3px 16px 3px 16px;background:linear-gradient(108deg,rgba(8,31,53,.94),rgba(12,48,67,.84));box-shadow:0 0 28px rgba(69,216,203,.09),0 10px 28px rgba(0,5,16,.34);transform:translateX(-50%)}.annual-keyword-sigil-scene__beacon::before{content:"";position:absolute;left:13px;right:13px;top:-1px;height:1px;background:linear-gradient(90deg,transparent,var(--sigil-gold),transparent)}.annual-keyword-sigil-scene__beacon span{color:#88b9c1;font-size:10px;letter-spacing:.08em}.annual-keyword-sigil-scene__beacon strong{color:#ffe8aa;font-size:clamp(15px,4.2vw,19px);line-height:1.15;white-space:nowrap;text-shadow:0 0 13px rgba(241,210,138,.28)}
.annual-keyword-sigil-scene__body{position:absolute;z-index:4;left:9%;right:9%;bottom:max(104px,calc(env(safe-area-inset-bottom) + 94px));margin:0;color:#c4d7dc;font-size:clamp(13px,3.5vw,16px);line-height:1.65;text-align:center;text-wrap:balance;text-shadow:0 2px 8px rgba(0,0,0,.35)}.annual-keyword-sigil-scene__closing{position:absolute;z-index:4;left:16%;right:16%;bottom:max(65px,calc(env(safe-area-inset-bottom) + 55px));margin:0;color:#709ca7;font-size:11px;line-height:1.4;letter-spacing:.11em;text-align:center}
.annual-keyword-sigil-scene.is-active:not(.is-static) .annual-keyword-sigil-scene__halo{animation:keyword-halo-in 1.05s ease-out both}.annual-keyword-sigil-scene.is-active:not(.is-static) .annual-keyword-sigil-scene__orbit--outer{animation:keyword-orbit-in .8s .15s ease-out both,keyword-orbit-turn 36s 1s linear infinite}.annual-keyword-sigil-scene.is-active:not(.is-static) .annual-keyword-sigil-scene__orbit--inner{animation:keyword-orbit-in .8s .22s ease-out both,keyword-orbit-turn-reverse 29s 1.02s linear infinite}.annual-keyword-sigil-scene.is-active:not(.is-static) .annual-keyword-sigil-scene__stars i{animation:keyword-star-breathe 3.8s ease-in-out infinite}.annual-keyword-sigil-scene.is-active:not(.is-static) .annual-keyword-sigil-scene__stars i:nth-child(3n+2){animation-delay:.7s}.annual-keyword-sigil-scene.is-active:not(.is-static) .annual-keyword-sigil-scene__stars i:nth-child(3n){animation-delay:1.4s}
@keyframes keyword-halo-in{from{opacity:0;transform:translate(-50%,-50%) scale(.72)}to{opacity:.9;transform:translate(-50%,-50%) scale(1)}}@keyframes keyword-orbit-in{from{opacity:0}to{opacity:1}}@keyframes keyword-orbit-turn{from{transform:translate(-50%,-50%) rotate(0)}to{transform:translate(-50%,-50%) rotate(360deg)}}@keyframes keyword-orbit-turn-reverse{from{transform:translate(-50%,-50%) rotate(360deg)}to{transform:translate(-50%,-50%) rotate(0)}}@keyframes keyword-star-breathe{0%,100%{opacity:.25}50%{opacity:.72}}
@media(max-height:650px) and (orientation:portrait){.annual-keyword-sigil-scene__content{padding-top:max(42px,calc(env(safe-area-inset-top) + 34px))}.annual-keyword-sigil-scene__eyebrow{font-size:10px}.annual-keyword-sigil-scene__title{margin-top:6px;font-size:clamp(1.85rem,10vw,2.35rem)}.annual-keyword-sigil-scene__lead{margin-top:5px;font-size:11px}.annual-keyword-sigil-scene__sigil-wrap{top:138px;width:min(calc(100vw - 26px),286px)}.annual-keyword-sigil-scene__beacon{bottom:106px;padding:7px 13px}.annual-keyword-sigil-scene__beacon strong{font-size:14px}.annual-keyword-sigil-scene__body{left:10%;right:10%;bottom:max(45px,calc(env(safe-area-inset-bottom) + 39px));font-size:12px;line-height:1.4}.annual-keyword-sigil-scene__closing{display:none}.annual-keyword-sigil-scene__tags li{padding:5px 7px;font-size:9px}.annual-keyword-sigil-scene__tags .is-rank-1{right:-2%;top:18%}.annual-keyword-sigil-scene__tags .is-rank-2{left:-2%}}
@media(orientation:landscape) and (max-height:460px){.annual-keyword-sigil-scene__content{width:min(100%,820px);padding:max(40px,calc(env(safe-area-inset-top) + 30px)) max(54px,calc(env(safe-area-inset-right) + 48px)) max(42px,calc(env(safe-area-inset-bottom) + 36px)) max(48px,calc(env(safe-area-inset-left) + 42px))}.annual-keyword-sigil-scene__header{width:37%;justify-items:start;text-align:left}.annual-keyword-sigil-scene__eyebrow{font-size:10px}.annual-keyword-sigil-scene__eyebrow::before{display:none}.annual-keyword-sigil-scene__title{max-width:9ch;margin-top:8px;font-size:clamp(2rem,6vh,2.7rem)}.annual-keyword-sigil-scene__lead{font-size:12px}.annual-keyword-sigil-scene__sigil-wrap{left:48%;top:12px;width:min(50vw,365px);transform:none}.annual-keyword-sigil-scene__beacon{left:48px;bottom:105px;max-width:34%;transform:none}.annual-keyword-sigil-scene__body{left:48px;right:auto;bottom:44px;width:34%;font-size:12px;line-height:1.45;text-align:left}.annual-keyword-sigil-scene__closing{display:none}.annual-keyword-sigil-scene__orbit{left:69%;top:50%}.annual-keyword-sigil-scene__halo{left:70%;top:50%;width:58vw}.annual-keyword-sigil-scene__tags li{font-size:10px}}
@media(prefers-reduced-motion:reduce){.annual-keyword-sigil-scene *{animation:none!important}}
</style>
