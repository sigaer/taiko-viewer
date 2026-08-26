<script setup lang="ts">
import { ref, toRef } from "vue";
import { useAnnualTimeline } from "~/composables/useAnnualTimeline";
import AnnualScene from "./AnnualScene.vue";

const props = withDefaults(defineProps<{
  active: boolean;
  reducedMotion: boolean;
  saveData?: boolean;
  tone?: "near" | "challenge";
  motionPreset?: "growth-near-glow" | "growth-challenge-pulse";
  ariaLabel?: string;
}>(), { saveData: false, tone: "near", motionPreset: "growth-near-glow", ariaLabel: "" });

const rootRef = ref<HTMLElement | null>(null);
useAnnualTimeline(rootRef, toRef(props, "active"), toRef(props, "reducedMotion"), { reenter: "restart" });
</script>

<template>
  <AnnualScene
    ref="rootRef"
    class="annual-profile-stage"
    :class="[`annual-profile-stage--${tone}`, `annual-profile-stage--${motionPreset}`, { 'is-save-data': saveData }]"
    mood="profile-stage"
    intensity="medium"
    :active="active"
    :reduced-motion="reducedMotion"
    :aria-label="ariaLabel"
  >
    <template #background>
      <div class="annual-profile-stage__backdrop">
        <div class="annual-profile-stage__curtain is-left" />
        <div class="annual-profile-stage__curtain is-right" />
        <div class="annual-profile-stage__stage-grid" />
      </div>
    </template>
    <template #atmosphere>
      <div class="annual-profile-stage__spotlight" aria-hidden="true"><i /><i /></div>
      <div class="annual-profile-stage__orbit" aria-hidden="true"><i /><i /><i /></div>
      <div v-if="!saveData" class="annual-profile-stage__beam-lines" aria-hidden="true"><i /><i /><i /></div>
      <slot name="atmosphere" />
    </template>
    <template #visual>
      <div class="annual-profile-stage__center" data-annual-stage="visual">
        <div class="annual-profile-stage__center-shadow" aria-hidden="true" />
        <slot name="center" />
      </div>
    </template>
    <template #data>
      <div class="annual-profile-stage__panels">
        <div class="annual-profile-stage__primary" data-annual-stage="data"><slot name="primary-panel" /></div>
        <div class="annual-profile-stage__secondary" data-annual-stage="data"><slot name="secondary-panel" /></div>
      </div>
    </template>
    <template #copy>
      <header class="annual-profile-stage__header" data-annual-stage="title"><slot name="header" /></header>
      <footer class="annual-profile-stage__footer" data-annual-stage="copy"><slot name="footer" /></footer>
    </template>
    <template #transition><slot name="transition" /></template>
  </AnnualScene>
</template>

<style scoped>
.annual-profile-stage{--stage-ink:#07172f;--stage-cyan:#5bd3f2;--stage-gold:#f2c45f;position:relative;width:100%;height:100%;min-height:100vh;color:#fff;background:var(--stage-ink)}
.annual-profile-stage__backdrop{position:absolute;inset:0;overflow:hidden;background:radial-gradient(ellipse at 50% 40%,rgba(31,126,191,.52),transparent 34%),linear-gradient(165deg,#061328 0%,#0b3260 54%,#061326 100%)}
.annual-profile-stage__curtain{position:absolute;top:-8%;bottom:-8%;width:43%;opacity:.7;background:repeating-linear-gradient(102deg,rgba(28,88,143,.36) 0 11%,rgba(3,17,39,.72) 12% 23%);filter:drop-shadow(0 0 30px rgba(0,0,0,.48))}.annual-profile-stage__curtain.is-left{left:-20%;transform:skewX(-7deg)}.annual-profile-stage__curtain.is-right{right:-20%;transform:scaleX(-1) skewX(-7deg)}
.annual-profile-stage__stage-grid{position:absolute;left:-25%;right:-25%;bottom:-13%;height:39%;border-top:1px solid rgba(91,211,242,.35);background:linear-gradient(rgba(91,211,242,.13) 1px,transparent 1px),linear-gradient(90deg,rgba(91,211,242,.13) 1px,transparent 1px);background-size:44px 25px;transform:perspective(330px) rotateX(62deg);transform-origin:50% 0;mask-image:linear-gradient(#000,transparent 88%)}
.annual-profile-stage__spotlight{position:absolute;inset:-6% 0 24%;overflow:hidden;clip-path:polygon(45% 0,55% 0,78% 100%,22% 100%);background:linear-gradient(180deg,rgba(182,229,255,.46),rgba(63,169,224,.13) 74%,transparent);filter:blur(1px)}.annual-profile-stage__spotlight::after{content:"";position:absolute;left:20%;right:20%;bottom:-7%;height:17%;border:1px solid rgba(116,219,255,.55);border-radius:50%;background:rgba(76,190,235,.13);box-shadow:0 0 48px rgba(74,193,241,.38)}.annual-profile-stage__spotlight i{position:absolute;top:0;bottom:0;width:1px;background:linear-gradient(transparent,rgba(255,255,255,.5),transparent)}.annual-profile-stage__spotlight i:first-child{left:37%;transform:rotate(-8deg)}.annual-profile-stage__spotlight i:last-child{right:37%;transform:rotate(8deg)}
.annual-profile-stage__orbit{position:absolute;left:50%;top:46%;width:min(76vw,410px);aspect-ratio:1;transform:translate(-50%,-50%)}.annual-profile-stage__orbit i{position:absolute;inset:0;border:1px solid rgba(91,211,242,.2);border-radius:50%}.annual-profile-stage__orbit i:nth-child(2){inset:7%;border-style:dashed}.annual-profile-stage__orbit i:nth-child(3){inset:14%;border-color:rgba(242,196,95,.28)}
.annual-profile-stage__beam-lines i{position:absolute;top:8%;bottom:8%;width:1px;background:linear-gradient(transparent,rgba(119,223,255,.2),transparent);transform:rotate(10deg)}.annual-profile-stage__beam-lines i:first-child{left:20%}.annual-profile-stage__beam-lines i:nth-child(2){right:20%;transform:rotate(-10deg)}.annual-profile-stage__beam-lines i:nth-child(3){left:50%;opacity:.35}
.annual-profile-stage__center{position:absolute;z-index:2;left:50%;top:42%;width:min(69vw,360px);aspect-ratio:1;transform:translate(-50%,-50%);display:grid;place-items:center}.annual-profile-stage__center-shadow{position:absolute;left:10%;right:10%;bottom:-8%;height:15%;border-radius:50%;background:rgba(0,8,27,.58);filter:blur(13px)}.annual-profile-stage__center :deep(.growth-song-stage){--stage-size:min(47vh,69vw,330px)}
.annual-profile-stage__panels{position:absolute;inset:0}.annual-profile-stage__primary{position:absolute;z-index:2;top:70%;left:50%;width:min(86%,410px);min-height:50px;padding:9px 38px;transform:translateX(-50%);box-sizing:border-box;color:#fff;text-align:center;background:linear-gradient(90deg,transparent 0 5%,#0c65a4 5% 95%,transparent 95%),linear-gradient(90deg,transparent,rgba(91,211,242,.4),transparent);clip-path:polygon(0 50%,7% 0,93% 0,100% 50%,93% 100%,7% 100%);filter:drop-shadow(0 8px 14px rgba(0,10,34,.48))}.annual-profile-stage__primary::before,.annual-profile-stage__primary::after{content:"";position:absolute;top:50%;width:33px;height:1px;background:var(--stage-gold)}.annual-profile-stage__primary::before{left:3%}.annual-profile-stage__primary::after{right:3%}.annual-profile-stage__primary :deep(span){display:block;color:rgba(204,235,250,.72);font-size:10px}.annual-profile-stage__primary :deep(strong){display:block;margin-top:3px;overflow-wrap:anywhere;font-size:clamp(.92rem,4vw,1.18rem);line-height:1.16}
.annual-profile-stage__secondary{position:absolute;z-index:3;top:78.4%;left:50%;min-width:142px;max-width:78%;padding:7px 18px 8px;transform:translateX(-50%);box-sizing:border-box;border-top:1px solid rgba(242,196,95,.65);border-bottom:1px solid rgba(242,196,95,.65);color:#fff2bf;background:rgba(5,24,50,.82);text-align:center;box-shadow:0 0 20px rgba(242,196,95,.18)}.annual-profile-stage--challenge .annual-profile-stage__secondary{border-color:rgba(91,211,242,.58);color:#d9f5ff;box-shadow:0 0 20px rgba(91,211,242,.16)}.annual-profile-stage__secondary :deep(span){display:block;color:rgba(204,235,250,.72);font-size:10px}.annual-profile-stage__secondary :deep(strong){display:block;margin-top:2px;overflow-wrap:anywhere;font-size:12px}
.annual-profile-stage__header{position:absolute;z-index:4;top:max(6%,calc(env(safe-area-inset-top) + 16px));left:6%;right:6%;text-align:center}.annual-profile-stage__header :deep(span){color:var(--stage-gold);font:800 10px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.14em}.annual-profile-stage__header :deep(h1){margin:7px 0 0;color:#d9f5ff;font:800 clamp(1.25rem,5.8vw,2rem)/1.1 var(--viewer-display-font)}.annual-profile-stage__header :deep(p){max-width:560px;margin:8px auto 0;color:rgba(210,237,249,.78);font:600 12px/1.5 var(--viewer-font-family)}
.annual-profile-stage__footer{position:absolute;left:9%;right:9%;bottom:max(7%,calc(env(safe-area-inset-bottom) + 48px));margin:0;color:rgba(210,237,249,.78);font:600 12px/1.5 var(--viewer-font-family);text-align:center}.annual-profile-stage__footer :deep(p){margin:0}.annual-profile-stage__footer :deep(strong){color:#fff2bf;font-weight:800}.annual-profile-stage.is-active:not(.is-reduced) .annual-profile-stage__spotlight{animation:profile-stage-spotlight 1.2s cubic-bezier(.2,.8,.2,1) both}.annual-profile-stage.is-active:not(.is-reduced) .annual-profile-stage__center{animation:profile-stage-center 1.05s cubic-bezier(.2,.75,.2,1) .35s both}.annual-profile-stage.is-active:not(.is-reduced) .annual-profile-stage__primary{animation:profile-stage-ribbon .76s cubic-bezier(.2,.8,.2,1) .8s both}.annual-profile-stage.is-active:not(.is-reduced) .annual-profile-stage__secondary{animation:profile-stage-badge 1s ease-out 1.1s both}.annual-profile-stage.is-active:not(.is-reduced) .annual-profile-stage__orbit i:nth-child(2){animation:profile-stage-orbit 16s linear 1s infinite}.annual-profile-stage:not(.is-active) *{animation-play-state:paused!important}.annual-profile-stage.is-reduced *{animation:none!important}@keyframes profile-stage-spotlight{from{clip-path:polygon(49% 0,51% 0,54% 100%,46% 100%);opacity:.1}to{clip-path:polygon(45% 0,55% 0,78% 100%,22% 100%);opacity:1}}@keyframes profile-stage-center{from{transform:translate(-50%,-50%) scale(.76);filter:brightness(.25)}to{transform:translate(-50%,-50%) scale(1);filter:none}}@keyframes profile-stage-ribbon{from{clip-path:polygon(48% 50%,50% 42%,52% 50%,50% 58%);filter:brightness(2)}to{clip-path:polygon(0 50%,7% 0,93% 0,100% 50%,93% 100%,7% 100%);filter:brightness(1)}}@keyframes profile-stage-badge{from{border-color:transparent;color:transparent;box-shadow:0 0 0 rgba(242,196,95,0)}45%{box-shadow:0 0 34px rgba(242,196,95,.68)}to{box-shadow:0 0 20px rgba(242,196,95,.18)}}@keyframes profile-stage-orbit{to{transform:rotate(360deg)}}
@media(max-width:720px){.annual-profile-stage__center{top:40%;width:min(65vw,285px)}.annual-profile-stage__center :deep(.growth-song-stage){--stage-size:min(41vh,65vw,270px)}.annual-profile-stage__primary{top:67%;width:92%;padding:8px 30px}.annual-profile-stage__secondary{top:76%;padding:7px 14px}.annual-profile-stage__header{top:max(4%,calc(env(safe-area-inset-top) + 12px))}.annual-profile-stage__header :deep(h1){font-size:clamp(1.2rem,5.8vw,1.7rem)}.annual-profile-stage__header :deep(p){margin-top:6px;font-size:11px;line-height:1.4}.annual-profile-stage__footer{bottom:max(6%,calc(env(safe-area-inset-bottom) + 42px));font-size:11px;line-height:1.45}.annual-profile-stage__orbit{top:43%;width:min(78vw,330px)}}
@media(max-height:700px) and (orientation:portrait){.annual-profile-stage__header{top:3%}.annual-profile-stage__center{top:38%;width:min(60vw,255px)}.annual-profile-stage__center :deep(.growth-song-stage){--stage-size:min(38vh,60vw,245px)}.annual-profile-stage__primary{top:64%}.annual-profile-stage__secondary{top:74%}.annual-profile-stage__footer{bottom:max(5%,calc(env(safe-area-inset-bottom) + 38px))}}
@media(orientation:landscape) and (max-height:460px){.annual-profile-stage__header{top:8%;left:48%;right:5%;text-align:left}.annual-profile-stage__center{top:49%;left:28%;width:min(67vh,300px)}.annual-profile-stage__center :deep(.growth-song-stage){--stage-size:min(68vh,285px)}.annual-profile-stage__primary{top:55%;left:70%;width:45%}.annual-profile-stage__secondary{top:72%;left:70%}.annual-profile-stage__footer{left:49%;right:7%;bottom:8%;text-align:left}.annual-profile-stage__spotlight{right:44%;clip-path:polygon(40% 0,60% 0,94% 100%,6% 100%)}}
@media(prefers-reduced-motion:reduce){.annual-profile-stage *{animation:none!important}}
.annual-profile-stage__footer{bottom:max(9%,calc(env(safe-area-inset-bottom) + 84px));line-height:1.55}.annual-profile-stage__footer :deep(p){max-width:560px;margin:0 auto}.annual-profile-stage__footer :deep(span){display:block}
.annual-profile-stage--growth-near-glow.is-active:not(.is-reduced) .annual-profile-stage__spotlight{animation-duration:1.35s}.annual-profile-stage--growth-near-glow.is-active:not(.is-reduced) .annual-profile-stage__center{animation-duration:.95s;animation-delay:.5s}.annual-profile-stage--growth-near-glow.is-active:not(.is-reduced) .annual-profile-stage__primary{animation-duration:.7s;animation-delay:1s}.annual-profile-stage--growth-near-glow.is-active:not(.is-reduced) .annual-profile-stage__secondary{animation-duration:.8s;animation-delay:1.35s}.annual-profile-stage--growth-near-glow.is-active:not(.is-reduced) .annual-profile-stage__footer{animation:profile-stage-footer .7s ease-out 1.8s both}
.annual-profile-stage--growth-challenge-pulse.is-active:not(.is-reduced) .annual-profile-stage__spotlight{animation-duration:.9s}.annual-profile-stage--growth-challenge-pulse.is-active:not(.is-reduced) .annual-profile-stage__center{animation-duration:.85s;animation-delay:.2s}.annual-profile-stage--growth-challenge-pulse.is-active:not(.is-reduced) .annual-profile-stage__primary{animation-duration:.55s;animation-delay:.65s}.annual-profile-stage--growth-challenge-pulse.is-active:not(.is-reduced) .annual-profile-stage__secondary{animation:profile-stage-challenge-badge .95s ease-out .9s both}.annual-profile-stage--growth-challenge-pulse.is-active:not(.is-reduced) .annual-profile-stage__footer{animation:profile-stage-footer .65s ease-out 1.55s both}.annual-profile-stage--growth-challenge-pulse.is-active:not(.is-reduced) .annual-profile-stage__orbit i:nth-child(2){animation-duration:11s}
@keyframes profile-stage-challenge-badge{from{transform:translateX(-50%) scale(.82);opacity:.25;box-shadow:0 0 0 rgba(91,211,242,0)}55%{transform:translateX(-50%) scale(1.04);opacity:1;box-shadow:0 0 30px rgba(91,211,242,.36)}to{transform:translateX(-50%) scale(1);opacity:1;box-shadow:0 0 24px rgba(91,211,242,.16)}}@keyframes profile-stage-footer{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@media(max-width:720px){.annual-profile-stage__footer{bottom:max(9%,calc(env(safe-area-inset-bottom) + 84px));font-size:11px;line-height:1.5}}
@media(max-height:700px) and (orientation:portrait){.annual-profile-stage__footer{bottom:max(7%,calc(env(safe-area-inset-bottom) + 72px))}}
</style>
