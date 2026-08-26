<script setup lang="ts">
import { computed, ref, toRef } from "vue";
import { useAnnualTimeline } from "~/composables/useAnnualTimeline";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import AnnualGrowthSongStage from "../AnnualGrowthSongStage.vue";
import AnnualScene from "../AnnualScene.vue";

const props = withDefaults(defineProps<{
  summary: VersionSummaryViewModel;
  pageIndex: number;
  pageTotal: number;
  active: boolean;
  reducedMotion: boolean;
  saveData?: boolean;
}>(), { saveData: false });

const rootRef = ref<HTMLElement | null>(null);
const formatter = new Intl.NumberFormat("zh-CN");
const safeNumber = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : 0;
const songName = computed(() => props.summary.challenge?.song?.name?.trim() || "这首歌");
const playCount = computed(() => safeNumber(props.summary.challenge?.playCount));
const observedPlayCount = computed(() => safeNumber(props.summary.challenge?.observedPlayCount));
const playCountText = computed(() => formatter.format(playCount.value));
const observedPlayCountText = computed(() => formatter.format(observedPlayCount.value));
const showObservedCount = computed(() => observedPlayCount.value !== playCount.value);

useAnnualTimeline(rootRef, toRef(props, "active"), toRef(props, "reducedMotion"), { reenter: "restart" });
</script>

<template>
  <AnnualScene v-if="summary.challenge" ref="rootRef" class="challenge-growth" mood="award-purple" intensity="high" :active="active" :reduced-motion="reducedMotion" :aria-label="summary.copy.challenge.title">
    <template #background><div class="challenge-growth__backdrop"><i /><i /><i /></div></template>
    <template #atmosphere>
      <div class="challenge-growth__spotlight" aria-hidden="true" />
      <div v-if="!saveData" class="challenge-growth__pressure" aria-hidden="true"><i v-for="index in 5" :key="index" /></div>
    </template>
    <div class="challenge-growth__frame">
      <header class="challenge-growth__header">
        <div class="challenge-growth__meta" data-annual-stage="title"><span>KEEP TRYING</span><small>{{ String(pageIndex + 1).padStart(2, "0") }} / {{ String(pageTotal).padStart(2, "0") }}</small></div>
        <h2 data-annual-stage="title">你向《{{ songName }}》敲了 {{ playCountText }} 次门</h2>
        <p data-annual-stage="copy">它还没有把答案全部交出来，而你也没有转身。每一次重来，都让下一槌更靠近。</p>
      </header>
      <div class="challenge-growth__main">
        <AnnualGrowthSongStage tone="challenge" size="large" :image-url="summary.challenge.song.coverUrl" :image-alt="songName" fallback="2026" :active="active" :reduced-motion="reducedMotion" :save-data="saveData" />
        <div class="challenge-growth__copy">
          <span data-annual-stage="data">成绩表里的累计挑战</span>
          <strong data-annual-stage="data">{{ playCountText }}</strong><b data-annual-stage="data">次</b>
          <small v-if="showObservedCount" data-annual-stage="copy">其中 {{ observedPlayCountText }} 次被这一版记录下来</small>
          <h3 data-annual-stage="copy">{{ songName }}</h3>
          <p data-annual-stage="copy">它还没有完全打开，而你也没有转身。</p>
        </div>
      </div>
    </div>
  </AnnualScene>
</template>

<style scoped>
.challenge-growth{--challenge-ink:#092d59;--challenge-blue:#175eaa;width:100%;height:100vh;height:100svh;height:100dvh;color:var(--challenge-ink);background:#dbeaf6}.challenge-growth__backdrop{position:absolute;inset:0;overflow:hidden;background:linear-gradient(148deg,#f0f8fe 0%,#dcecf8 48%,#c5d9e9 100%)}.challenge-growth__backdrop::after{content:"";position:absolute;inset:0;background:linear-gradient(105deg,rgba(255,255,255,.38) 0 30%,transparent 50%),radial-gradient(ellipse at 21% 60%,rgba(70,153,213,.2),transparent 32%)}.challenge-growth__backdrop>i{position:absolute;top:-12%;bottom:-12%;width:1px;background:linear-gradient(transparent,rgba(25,88,150,.18),transparent);transform:rotate(14deg)}.challenge-growth__backdrop>i:first-child{left:26%}.challenge-growth__backdrop>i:nth-child(2){left:58%}.challenge-growth__backdrop>i:nth-child(3){left:82%}.challenge-growth__spotlight{position:absolute;left:-10%;top:10%;width:75%;height:83%;clip-path:polygon(39% 0,57% 0,96% 100%,0 100%);background:linear-gradient(180deg,rgba(255,255,255,.62),rgba(37,119,185,.17) 68%,transparent);opacity:.78}.challenge-growth__pressure i{position:absolute;top:28%;width:1px;height:52%;background:linear-gradient(transparent,rgba(19,78,136,.24),transparent);transform:rotate(11deg);animation:challenge-pressure 3.6s ease-in-out infinite}.challenge-growth__pressure i:nth-child(1){left:48%;animation-delay:-.4s}.challenge-growth__pressure i:nth-child(2){left:58%;animation-delay:-1.1s}.challenge-growth__pressure i:nth-child(3){left:68%;animation-delay:-2.2s}.challenge-growth__pressure i:nth-child(4){left:78%;animation-delay:-1.7s}.challenge-growth__pressure i:nth-child(5){left:88%;animation-delay:-2.8s}.challenge-growth__frame{position:relative;width:min(1080px,100%);height:100%;margin:auto;padding:max(70px,calc(env(safe-area-inset-top) + 60px)) clamp(24px,5vw,68px) max(62px,calc(env(safe-area-inset-bottom) + 52px));box-sizing:border-box}.challenge-growth__header{position:relative;z-index:3;max-width:860px}.challenge-growth__meta{display:flex;align-items:center;gap:14px;color:var(--challenge-blue);font:900 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.2em}.challenge-growth__meta::after{content:"";width:88px;height:2px;background:linear-gradient(90deg,var(--challenge-blue),transparent)}.challenge-growth__meta small{margin-left:auto;color:rgba(9,55,102,.5);font:800 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.06em}.challenge-growth__header h2{max-width:840px;margin:12px 0 8px;color:#082c57;font:900 clamp(2.15rem,5.7vw,5rem)/.98 var(--viewer-display-font);letter-spacing:-.055em;overflow-wrap:anywhere;text-shadow:0 10px 28px rgba(18,74,126,.08)}.challenge-growth__header>p{max-width:650px;margin:0;color:#416c93;font:600 clamp(.82rem,1.6vw,1.02rem)/1.6 var(--viewer-font-family)}.challenge-growth__main{position:absolute;left:clamp(20px,4vw,58px);right:clamp(24px,5vw,68px);top:43%;bottom:7%;display:grid;grid-template-columns:minmax(250px,.94fr) minmax(220px,1.06fr);align-items:center;gap:clamp(24px,6vw,78px)}.challenge-growth__copy{position:relative;z-index:2;align-self:center;padding-top:2%}.challenge-growth__copy>span{display:block;color:#3c6b96;font:800 11px/1.2 var(--viewer-font-family);letter-spacing:.12em}.challenge-growth__copy>strong{display:inline-block;margin:3px 0 0;color:#0c4f98;font:900 clamp(6rem,16vw,12rem)/.72 var(--viewer-display-font);letter-spacing:-.085em;text-shadow:0 18px 32px rgba(15,71,132,.2)}.challenge-growth__copy>b{display:inline-block;margin-left:10px;color:#174f86;font:900 clamp(1.05rem,2.7vw,1.7rem)/1 var(--viewer-display-font)}.challenge-growth__copy>small{display:block;max-width:310px;margin-top:13px;padding-top:10px;border-top:1px solid rgba(26,90,151,.2);color:#557794;font:700 10px/1.35 var(--viewer-font-family)}.challenge-growth__copy h3{max-width:480px;margin:17px 0 7px;color:#0e3560;font:850 clamp(1.45rem,3.4vw,2.6rem)/1.07 var(--viewer-display-font);overflow-wrap:anywhere}.challenge-growth__copy p{max-width:370px;margin:0;color:#4f718f;font:650 12px/1.55 var(--viewer-font-family)}.challenge-growth.is-active:not(.is-reduced) .challenge-growth__copy>strong{animation:challenge-count-impact .74s cubic-bezier(.16,.88,.22,1.18) 1.08s both}.challenge-growth:not(.is-active) *{animation-play-state:paused!important}.challenge-growth.is-reduced *{animation:none!important}@keyframes challenge-pressure{50%{opacity:.25;transform:translateX(10px) rotate(11deg)}}@keyframes challenge-count-impact{from{transform:translateY(20px) scale(.72);opacity:0}70%{transform:translateY(0) scale(1.04);opacity:1}to{transform:scale(1)}}@media(max-width:720px) and (orientation:portrait){.challenge-growth__frame{padding:max(66px,calc(env(safe-area-inset-top) + 54px)) 19px max(56px,calc(env(safe-area-inset-bottom) + 48px))}.challenge-growth__header h2{margin-top:10px;font-size:clamp(1.9rem,8.7vw,2.5rem);line-height:.99}.challenge-growth__header>p{max-width:95%;font-size:12px;line-height:1.48}.challenge-growth__meta{font-size:10px}.challenge-growth__main{left:-32px;right:17px;top:44%;bottom:8%;grid-template-columns:minmax(190px,1.03fr) minmax(132px,.72fr);gap:2px}.challenge-growth__copy{padding-top:16%}.challenge-growth__copy>span{font-size:10px;line-height:1.35;letter-spacing:.05em}.challenge-growth__copy>strong{font-size:clamp(5.3rem,23vw,6.6rem);line-height:.75}.challenge-growth__copy>b{margin-left:5px;font-size:15px}.challenge-growth__copy>small{margin-top:10px;padding-top:8px;font-size:10px}.challenge-growth__copy h3{margin:12px 0 5px;font-size:clamp(1.05rem,4.8vw,1.32rem)}.challenge-growth__copy p{font-size:11px;line-height:1.4}.challenge-growth__backdrop>i:nth-child(2){left:67%}.challenge-growth__backdrop>i:nth-child(3){left:90%}}@media(max-height:700px) and (orientation:portrait){.challenge-growth__frame{padding-top:55px}.challenge-growth__header h2{font-size:1.72rem;margin:7px 0 4px}.challenge-growth__header>p{line-height:1.35}.challenge-growth__main{top:42%;bottom:6%}.challenge-growth__copy{padding-top:9%}.challenge-growth__copy>strong{font-size:4.8rem}.challenge-growth__copy h3{margin:8px 0 4px}}@media(orientation:landscape) and (max-height:460px){.challenge-growth__frame{padding:44px 50px 32px}.challenge-growth__header{max-width:49%}.challenge-growth__header h2{margin:7px 0 4px;font-size:clamp(1.65rem,4vw,2.7rem)}.challenge-growth__header>p{font-size:11px;line-height:1.35}.challenge-growth__main{left:48%;right:42px;top:9%;bottom:8%;grid-template-columns:auto 1fr;gap:19px}.challenge-growth__copy{padding-top:5%}.challenge-growth__copy>strong{font-size:4.5rem}.challenge-growth__copy>small{margin-top:7px;padding-top:6px}.challenge-growth__copy h3{margin:8px 0 4px;font-size:1.18rem}}@media(prefers-reduced-motion:reduce){.challenge-growth *{animation:none!important}}
</style>
