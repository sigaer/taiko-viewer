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
const songName = computed(() => props.summary.nearDondaful?.song?.name?.trim() || "这首歌");
const okCountText = computed(() => formatter.format(safeNumber(props.summary.nearDondaful?.okCount)));
const scoreText = computed(() => formatter.format(safeNumber(props.summary.nearDondaful?.score)));

useAnnualTimeline(rootRef, toRef(props, "active"), toRef(props, "reducedMotion"), { reenter: "restart" });
</script>

<template>
  <AnnualScene v-if="summary.nearDondaful" ref="rootRef" class="near-growth" mood="award-purple" intensity="medium" :active="active" :reduced-motion="reducedMotion" :aria-label="summary.copy.nearDondaful.title">
    <template #background><div class="near-growth__backdrop"><i class="near-growth__wash" /><i class="near-growth__finish-line" /></div></template>
    <template #atmosphere>
      <div class="near-growth__spotlight" aria-hidden="true" />
      <div v-if="!saveData" class="near-growth__sparks" aria-hidden="true"><i v-for="index in 7" :key="index" /></div>
    </template>
    <div class="near-growth__frame">
      <header class="near-growth__header">
        <div class="near-growth__meta" data-annual-stage="title"><span>ALMOST DONDAFUL</span><small>{{ String(pageIndex + 1).padStart(2, "0") }} / {{ String(pageTotal).padStart(2, "0") }}</small></div>
        <h2 data-annual-stage="title">《{{ songName }}》，离全良只差 {{ okCountText }} 个可</h2>
        <p data-annual-stage="copy">鼓面已经亮到最后一小步。下一次落槌，也许就是满屏金光。</p>
      </header>
      <div class="near-growth__main">
        <AnnualGrowthSongStage tone="near" size="large" :image-url="summary.nearDondaful.song.coverUrl" :image-alt="songName" fallback="2026" :active="active" :reduced-motion="reducedMotion" :save-data="saveData" />
        <div class="near-growth__copy">
          <p class="near-growth__ok" data-annual-stage="data">只差 <strong>{{ okCountText }}</strong> 个可</p>
          <h3 data-annual-stage="data">{{ songName }}</h3>
          <div class="near-growth__score" data-annual-stage="copy"><span>已经写下的最高分</span><strong>{{ scoreText }}</strong></div>
        </div>
      </div>
    </div>
  </AnnualScene>
</template>

<style scoped>
.near-growth{--near-ink:#123c6c;--near-blue:#2e78c1;--near-gold:#dcaa36;width:100%;height:100vh;height:100svh;height:100dvh;color:var(--near-ink);background:#eaf6ff}.near-growth__backdrop{position:absolute;inset:0;overflow:hidden;background:linear-gradient(154deg,#f8fcff 0%,#e5f4ff 45%,#d6ebfb 100%)}.near-growth__backdrop::before{content:"";position:absolute;inset:0;background:linear-gradient(104deg,transparent 0 26%,rgba(255,255,255,.72) 42%,transparent 60%);opacity:.64}.near-growth__wash{position:absolute;width:92%;aspect-ratio:1;left:-47%;top:34%;border-radius:50%;border:1px solid rgba(48,128,196,.17);box-shadow:0 0 0 25px rgba(255,255,255,.2),0 0 0 54px rgba(48,128,196,.05)}.near-growth__finish-line{position:absolute;right:7%;top:31%;width:25%;height:1px;background:linear-gradient(90deg,transparent,rgba(218,165,52,.78))}.near-growth__finish-line::after{content:"";position:absolute;right:0;top:-3px;width:7px;height:7px;border-radius:50%;background:#f5ca62;box-shadow:0 0 16px rgba(226,174,53,.74)}.near-growth__spotlight{position:absolute;left:-8%;top:14%;width:74%;height:72%;clip-path:polygon(34% 0,57% 0,93% 100%,0 100%);background:linear-gradient(180deg,rgba(255,255,255,.72),rgba(112,193,239,.13) 68%,transparent);opacity:.68}.near-growth__sparks i{position:absolute;width:4px;height:4px;border-radius:50%;background:#f0be4d;box-shadow:0 0 10px rgba(232,179,54,.62);animation:near-spark 3.4s ease-in-out infinite}.near-growth__sparks i:nth-child(1){left:10%;top:31%;animation-delay:-.4s}.near-growth__sparks i:nth-child(2){left:23%;top:56%;animation-delay:-1.7s}.near-growth__sparks i:nth-child(3){left:42%;top:39%;animation-delay:-2.5s}.near-growth__sparks i:nth-child(4){left:72%;top:43%;animation-delay:-.9s}.near-growth__sparks i:nth-child(5){left:85%;top:66%;animation-delay:-2.1s}.near-growth__sparks i:nth-child(6){left:57%;top:75%;animation-delay:-1.2s}.near-growth__sparks i:nth-child(7){left:33%;top:82%;animation-delay:-3s}.near-growth__frame{position:relative;width:min(1080px,100%);height:100%;margin:auto;padding:max(76px,calc(env(safe-area-inset-top) + 64px)) clamp(24px,5vw,68px) max(62px,calc(env(safe-area-inset-bottom) + 52px));box-sizing:border-box}.near-growth__header{position:relative;z-index:3;max-width:820px}.near-growth__meta{display:flex;align-items:center;gap:14px;color:var(--near-blue);font:800 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.18em}.near-growth__meta::after{content:"";width:72px;height:1px;background:linear-gradient(90deg,var(--near-blue),transparent)}.near-growth__meta small{margin-left:auto;color:rgba(32,91,151,.45);font:800 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.06em}.near-growth__header h2{max-width:800px;margin:14px 0 9px;color:var(--near-ink);font:800 clamp(1.9rem,4.8vw,4.1rem)/1.06 var(--viewer-display-font);letter-spacing:-.035em;overflow-wrap:anywhere}.near-growth__header>p{max-width:610px;margin:0;color:#53789b;font:600 clamp(.82rem,1.6vw,1.02rem)/1.65 var(--viewer-font-family)}.near-growth__main{position:absolute;left:clamp(24px,5vw,68px);right:clamp(24px,5vw,68px);top:43%;bottom:8%;display:grid;grid-template-columns:minmax(240px,.92fr) minmax(220px,1.08fr);align-items:center;gap:clamp(28px,7vw,88px)}.near-growth__copy{position:relative;z-index:2;align-self:center;padding-top:7%}.near-growth__ok{margin:0;color:#47719a;font:700 clamp(.92rem,2vw,1.15rem)/1.2 var(--viewer-font-family)}.near-growth__ok strong{display:inline-block;margin:0 4px;color:var(--near-blue);font:800 clamp(3.8rem,10vw,7.6rem)/.76 var(--viewer-display-font);letter-spacing:-.07em;text-shadow:0 13px 28px rgba(42,112,184,.13)}.near-growth__copy h3{max-width:500px;margin:22px 0 20px;color:#163d68;font:800 clamp(1.55rem,3.7vw,3rem)/1.08 var(--viewer-display-font);overflow-wrap:anywhere}.near-growth__score{width:min(320px,100%);padding:13px 18px 15px;border:1px solid rgba(50,125,190,.16);border-radius:18px;background:rgba(250,253,255,.72);box-shadow:0 14px 32px rgba(50,104,156,.08)}.near-growth__score span{display:block;color:#6a88a5;font:700 11px/1.2 var(--viewer-font-family)}.near-growth__score strong{display:block;margin-top:5px;color:#2b70b4;font:800 clamp(1.5rem,3.6vw,2.5rem)/1 var(--viewer-display-font);letter-spacing:.02em}.near-growth.is-active:not(.is-reduced) .near-growth__finish-line::after{animation:near-finish-light 1.8s ease-in-out infinite}.near-growth:not(.is-active) *{animation-play-state:paused!important}.near-growth.is-reduced *{animation:none!important}@keyframes near-spark{50%{transform:translateY(-8px) scale(1.5);opacity:.42}}@keyframes near-finish-light{50%{transform:scale(1.45);box-shadow:0 0 23px rgba(226,174,53,.9)}}@media(max-width:720px) and (orientation:portrait){.near-growth__frame{padding:max(70px,calc(env(safe-area-inset-top) + 58px)) 20px max(56px,calc(env(safe-area-inset-bottom) + 48px))}.near-growth__header h2{margin-top:12px;font-size:clamp(1.65rem,7.7vw,2.15rem);line-height:1.08}.near-growth__header>p{max-width:92%;font-size:12px;line-height:1.55}.near-growth__meta{font-size:10px}.near-growth__main{left:-25px;right:18px;top:43%;bottom:10%;grid-template-columns:minmax(190px,1.04fr) minmax(130px,.72fr);gap:5px}.near-growth__copy{padding-top:17%}.near-growth__ok{font-size:12px;white-space:nowrap}.near-growth__ok strong{display:block;margin:0 0 4px;font-size:clamp(3.7rem,17vw,4.8rem);line-height:.82}.near-growth__copy h3{margin:14px 0 12px;font-size:clamp(1.05rem,4.9vw,1.35rem);line-height:1.1}.near-growth__score{padding:10px 11px 11px;border-radius:14px}.near-growth__score span{font-size:10px}.near-growth__score strong{font-size:clamp(1.18rem,5.6vw,1.45rem)}.near-growth__finish-line{top:37%;right:4%;width:29%}}@media(max-height:700px) and (orientation:portrait){.near-growth__frame{padding-top:58px}.near-growth__header h2{font-size:1.55rem;margin:8px 0 5px}.near-growth__header>p{line-height:1.4}.near-growth__main{top:41%;bottom:7%}.near-growth__copy{padding-top:10%}.near-growth__copy h3{margin:9px 0}.near-growth__ok strong{font-size:3.4rem}}@media(orientation:landscape) and (max-height:460px){.near-growth__frame{padding:48px 52px 34px}.near-growth__header{max-width:49%}.near-growth__header h2{margin:8px 0 5px;font-size:clamp(1.4rem,3.7vw,2.5rem)}.near-growth__header>p{font-size:11px;line-height:1.4}.near-growth__main{left:48%;right:44px;top:12%;bottom:10%;grid-template-columns:auto 1fr;gap:22px}.near-growth__copy{padding-top:8%}.near-growth__ok strong{font-size:3.3rem}.near-growth__copy h3{margin:10px 0;font-size:1.25rem}.near-growth__score{padding:9px 12px}.near-growth__score strong{font-size:1.35rem}}@media(prefers-reduced-motion:reduce){.near-growth *{animation:none!important}}
</style>
