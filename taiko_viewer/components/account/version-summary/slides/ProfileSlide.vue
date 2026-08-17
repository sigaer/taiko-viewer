<script setup lang="ts">
import { computed, ref, toRef } from "vue";
import { useAnnualTimeline } from "~/composables/useAnnualTimeline";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import AnnualDrumWindow from "../AnnualDrumWindow.vue";
import AnnualScene from "../AnnualScene.vue";
import ParticleLayer from "../ParticleLayer.vue";

const props = defineProps<{
  summary: VersionSummaryViewModel;
  pageIndex: number;
  pageTotal: number;
  active: boolean;
  reducedMotion: boolean;
}>();

const { t } = useI18n();
const profile = computed(() => props.summary.profileCard);
const rootRef = ref<HTMLElement | null>(null);

useAnnualTimeline(rootRef, toRef(props, "active"), toRef(props, "reducedMotion"), { reenter: "restart" });
</script>

<template>
  <AnnualScene
    ref="rootRef"
    class="profile-slide"
    mood="profile-stage"
    intensity="medium"
    :active="active"
    :reduced-motion="reducedMotion"
    :aria-label="summary.copy.profile.title"
  >
    <template #background>
      <div class="profile-slide__backdrop">
        <div class="profile-slide__curtain is-left" />
        <div class="profile-slide__curtain is-right" />
        <div class="profile-slide__stage-grid" />
      </div>
    </template>

    <template #atmosphere>
      <div class="profile-slide__spotlight" aria-hidden="true"><i /><i /></div>
      <ParticleLayer :active="active" :reduced-motion="reducedMotion" density="low" palette="gold" />
      <div class="profile-slide__orbit" aria-hidden="true"><i /><i /><i /></div>
    </template>

    <template #visual>
      <div class="profile-slide__portrait" data-annual-stage="visual">
        <div class="profile-slide__portrait-shadow" aria-hidden="true" />
        <AnnualDrumWindow
          size="large"
          fallback-kind="don"
          :image-url="profile?.myDonUrl"
          :image-alt="profile?.nickname || summary.user.nickname"
          :fallback="t('annualSummary.common.defaultDon')"
        />
        <span class="profile-slide__stage-mark" aria-hidden="true">PLAYER 01</span>
      </div>
    </template>

    <template #data>
      <div class="profile-slide__identity">
        <span class="profile-slide__mode" data-annual-stage="title">
          {{ t(summary.mode === "current_archive" ? "annualSummary.common.archive" : "annualSummary.common.observed") }}
        </span>
        <h1 data-annual-stage="data">{{ profile?.nickname || summary.user.nickname }}</h1>
        <div class="profile-slide__title-ribbon" data-annual-stage="data">
          <span>{{ t("annualSummary.slides.profile.currentTitle") }}</span>
          <strong>{{ profile?.title || t("annualSummary.slides.profile.noTitle") }}</strong>
        </div>
        <div class="profile-slide__dan-badge" data-annual-stage="data">
          <span>{{ t("annualSummary.slides.profile.dan") }}</span>
          <strong>{{ profile?.danName || t("annualSummary.slides.profile.noDan") }}</strong>
        </div>
      </div>
    </template>

    <template #copy>
      <header class="profile-slide__intro">
        <span data-annual-stage="title">PROFILE SPOTLIGHT · 2026</span>
        <h2 data-annual-stage="title">{{ t("annualSummary.slides.profile.title") }}</h2>
      </header>
      <p class="profile-slide__closing" data-annual-stage="copy">{{ t("annualSummary.slides.profile.lead") }}</p>
      <span class="profile-slide__counter" data-annual-stage="copy">{{ String(pageIndex + 1).padStart(2, "0") }} / {{ String(pageTotal).padStart(2, "0") }}</span>
    </template>

    <template #transition>
      <div class="profile-slide__light-curtain" aria-hidden="true"><i /><i /></div>
    </template>
  </AnnualScene>
</template>

<style scoped>
.profile-slide { --profile-ink:#07172f; --profile-cyan:#5bd3f2; --profile-gold:#f2c45f; width:100%; height:100vh; height:100svh; height:100dvh; color:#fff; background:var(--profile-ink); }
.profile-slide__backdrop { position:absolute; inset:0; overflow:hidden; background:radial-gradient(ellipse at 50% 40%, rgba(31,126,191,.52), transparent 34%), linear-gradient(165deg,#061328 0%,#0b3260 54%,#061326 100%); }
.profile-slide__curtain { position:absolute; top:-8%; bottom:-8%; width:43%; opacity:.7; background:repeating-linear-gradient(102deg,rgba(28,88,143,.36) 0 11%,rgba(3,17,39,.72) 12% 23%); filter:drop-shadow(0 0 30px rgba(0,0,0,.48)); }
.profile-slide__curtain.is-left { left:-20%; transform:skewX(-7deg); } .profile-slide__curtain.is-right { right:-20%; transform:scaleX(-1) skewX(-7deg); }
.profile-slide__stage-grid { position:absolute; left:-25%; right:-25%; bottom:-13%; height:39%; border-top:1px solid rgba(91,211,242,.35); background:linear-gradient(rgba(91,211,242,.13) 1px,transparent 1px),linear-gradient(90deg,rgba(91,211,242,.13) 1px,transparent 1px); background-size:44px 25px; transform:perspective(330px) rotateX(62deg); transform-origin:50% 0; mask-image:linear-gradient(#000,transparent 88%); }
.profile-slide__spotlight { position:absolute; inset:-6% 0 24%; overflow:hidden; clip-path:polygon(45% 0,55% 0,78% 100%,22% 100%); background:linear-gradient(180deg,rgba(182,229,255,.46),rgba(63,169,224,.13) 74%,transparent); filter:blur(1px); }
.profile-slide__spotlight::after { content:""; position:absolute; left:20%; right:20%; bottom:-7%; height:17%; border:1px solid rgba(116,219,255,.55); border-radius:50%; background:rgba(76,190,235,.13); box-shadow:0 0 48px rgba(74,193,241,.38); }
.profile-slide__spotlight i { position:absolute; top:0; bottom:0; width:1px; background:linear-gradient(transparent,rgba(255,255,255,.5),transparent); } .profile-slide__spotlight i:first-child { left:37%; transform:rotate(-8deg); } .profile-slide__spotlight i:last-child { right:37%; transform:rotate(8deg); }
.profile-slide__orbit { position:absolute; left:50%; top:46%; width:min(76vw,410px); aspect-ratio:1; transform:translate(-50%,-50%); } .profile-slide__orbit i { position:absolute; inset:calc(var(--orbit,0) * 7%); border:1px solid rgba(91,211,242,.2); border-radius:50%; } .profile-slide__orbit i:nth-child(2) { --orbit:1; border-style:dashed; } .profile-slide__orbit i:nth-child(3) { --orbit:2; border-color:rgba(242,196,95,.28); }
.profile-slide__portrait { position:absolute; z-index:2; left:50%; top:42%; width:min(69vw,360px); aspect-ratio:1; transform:translate(-50%,-50%); display:grid; place-items:center; }
.profile-slide__portrait :deep(.drum-window) { --drum-size:min(47vh,69vw,330px); background:linear-gradient(145deg,#56d2f0,#175b9c 55%,#082c59); box-shadow:0 34px 74px rgba(0,8,26,.6),0 0 0 1px rgba(155,231,255,.46),0 0 42px rgba(69,190,235,.3),inset 0 0 0 11px rgba(2,26,59,.28); }
.profile-slide__portrait :deep(.drum-window__membrane) { background:radial-gradient(circle at 42% 27%,#fff 0,#dbeaf2 54%,#9cc5db 100%); box-shadow:inset 0 -20px 40px rgba(21,90,129,.23),0 0 0 5px rgba(220,248,255,.75); }
.profile-slide__portrait-shadow { position:absolute; left:10%; right:10%; bottom:-8%; height:15%; border-radius:50%; background:rgba(0,8,27,.58); filter:blur(13px); }
.profile-slide__stage-mark { position:absolute; right:-4%; bottom:4%; color:rgba(147,225,250,.58); font:800 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace; writing-mode:vertical-rl; }
.profile-slide__identity { position:absolute; inset:0; }
.profile-slide__mode { position:absolute; top:27.5%; left:7%; color:var(--profile-gold); font:800 10px/1.2 var(--viewer-font-family); writing-mode:vertical-rl; }
.profile-slide__identity h1 { position:absolute; z-index:3; top:58%; left:6%; right:6%; margin:0; overflow-wrap:anywhere; color:#fff; font:800 clamp(2.2rem,11vw,4.6rem)/.96 var(--viewer-display-font); text-align:center; text-shadow:0 4px 24px rgba(0,8,25,.9),0 0 24px rgba(63,184,230,.3); }
.profile-slide__title-ribbon { position:absolute; z-index:2; top:70%; left:50%; width:min(86%,410px); min-height:50px; padding:9px 38px; transform:translateX(-50%); color:#fff; text-align:center; background:linear-gradient(90deg,transparent 0 5%,#0c65a4 5% 95%,transparent 95%),linear-gradient(90deg,transparent,rgba(91,211,242,.4),transparent); clip-path:polygon(0 50%,7% 0,93% 0,100% 50%,93% 100%,7% 100%); filter:drop-shadow(0 8px 14px rgba(0,10,34,.48)); }
.profile-slide__title-ribbon::before,.profile-slide__title-ribbon::after { content:""; position:absolute; top:50%; width:33px; height:1px; background:var(--profile-gold); } .profile-slide__title-ribbon::before { left:3%; } .profile-slide__title-ribbon::after { right:3%; }
.profile-slide__title-ribbon span,.profile-slide__dan-badge span { display:block; color:rgba(204,235,250,.72); font-size:10px; } .profile-slide__title-ribbon strong { display:block; margin-top:3px; overflow-wrap:anywhere; font-size:clamp(.92rem,4vw,1.18rem); line-height:1.16; }
.profile-slide__dan-badge { position:absolute; z-index:3; top:78.4%; left:50%; min-width:142px; max-width:70%; padding:7px 18px 8px; transform:translateX(-50%); border-top:1px solid rgba(242,196,95,.65); border-bottom:1px solid rgba(242,196,95,.65); color:#fff2bf; background:rgba(5,24,50,.82); text-align:center; box-shadow:0 0 20px rgba(242,196,95,.18); } .profile-slide__dan-badge strong { display:block; margin-top:2px; overflow-wrap:anywhere; font-size:12px; }
.profile-slide__intro { position:absolute; z-index:4; top:max(6%,calc(env(safe-area-inset-top) + 16px)); left:6%; right:6%; text-align:center; } .profile-slide__intro > span { color:var(--profile-gold); font:800 10px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace; } .profile-slide__intro h2 { margin:7px 0 0; color:#d9f5ff; font:800 clamp(1.25rem,5.8vw,2rem)/1.1 var(--viewer-display-font); }
.profile-slide__closing { position:absolute; left:9%; right:9%; bottom:max(7%,calc(env(safe-area-inset-bottom) + 48px)); margin:0; color:rgba(210,237,249,.78); font:600 12px/1.5 var(--viewer-font-family); text-align:center; }
.profile-slide__counter { position:absolute; left:5%; bottom:max(16px,env(safe-area-inset-bottom)); color:rgba(157,218,243,.52); font:800 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace; }
.profile-slide__light-curtain i { position:absolute; top:0; bottom:0; width:1px; opacity:.28; background:linear-gradient(transparent,#77dfff,transparent); } .profile-slide__light-curtain i:first-child { left:4%; } .profile-slide__light-curtain i:last-child { right:4%; }
.profile-slide.is-active:not(.is-reduced) .profile-slide__spotlight { animation:profile-spotlight-open 1.2s cubic-bezier(.2,.8,.2,1) both; } .profile-slide.is-active:not(.is-reduced) .profile-slide__portrait :deep(.drum-window) { animation:profile-portrait-develop 1.05s cubic-bezier(.2,.75,.2,1) .58s both; } .profile-slide.is-active:not(.is-reduced) .profile-slide__title-ribbon { animation:profile-ribbon-unfurl .76s cubic-bezier(.2,.8,.2,1) 1.22s both; } .profile-slide.is-active:not(.is-reduced) .profile-slide__dan-badge { animation:profile-badge-light 1s ease-out 1.64s both; } .profile-slide.is-active:not(.is-reduced) .profile-slide__orbit i:nth-child(2) { animation:profile-orbit-turn 16s linear 2s infinite; }
@keyframes profile-spotlight-open { from { clip-path:polygon(49% 0,51% 0,54% 100%,46% 100%); opacity:.1; } to { clip-path:polygon(45% 0,55% 0,78% 100%,22% 100%); opacity:1; } }
@keyframes profile-portrait-develop { from { clip-path:inset(0 0 100%); filter:brightness(.12) saturate(0) blur(8px); } 58% { filter:brightness(.5) saturate(.35) blur(2px); } to { clip-path:inset(0); filter:brightness(1) saturate(1) blur(0); } }
@keyframes profile-ribbon-unfurl { from { clip-path:polygon(48% 50%,50% 42%,52% 50%,50% 58%); filter:brightness(2); } to { clip-path:polygon(0 50%,7% 0,93% 0,100% 50%,93% 100%,7% 100%); filter:brightness(1); } }
@keyframes profile-badge-light { from { border-color:transparent; color:transparent; box-shadow:0 0 0 rgba(242,196,95,0); } 45% { color:#fff; box-shadow:0 0 34px rgba(242,196,95,.68); } to { border-color:rgba(242,196,95,.65); color:#fff2bf; box-shadow:0 0 20px rgba(242,196,95,.18); } }
@keyframes profile-orbit-turn { to { transform:rotate(360deg); } }
@media (min-width:700px) and (orientation:portrait) { .profile-slide__portrait { width:min(58vw,430px); } .profile-slide__portrait :deep(.drum-window) { --drum-size:min(48vh,56vw,390px); } }
@media (orientation:landscape) and (max-height:460px) { .profile-slide__intro { top:8%; left:48%; right:5%; text-align:left; } .profile-slide__portrait { top:49%; left:28%; width:min(67vh,300px); } .profile-slide__portrait :deep(.drum-window) { --drum-size:min(68vh,285px); } .profile-slide__identity h1 { top:30%; left:49%; right:5%; text-align:left; font-size:clamp(2rem,6vw,3.8rem); } .profile-slide__mode { top:35%; left:45%; } .profile-slide__title-ribbon { top:55%; left:70%; width:45%; } .profile-slide__dan-badge { top:72%; left:70%; } .profile-slide__closing { left:49%; right:7%; bottom:8%; text-align:left; } .profile-slide__spotlight { right:44%; clip-path:polygon(40% 0,60% 0,94% 100%,6% 100%); } }
@media (max-height:690px) and (orientation:portrait) { .profile-slide__intro { top:4%; } .profile-slide__portrait { top:39%; width:min(58vw,270px); } .profile-slide__portrait :deep(.drum-window) { --drum-size:min(41vh,58vw,255px); } .profile-slide__identity h1 { top:55%; } .profile-slide__title-ribbon { top:67%; } .profile-slide__dan-badge { top:77%; } .profile-slide__closing { bottom:max(6%,calc(env(safe-area-inset-bottom) + 42px)); } }
@media (prefers-reduced-motion:reduce) { .profile-slide__spotlight,.profile-slide__portrait :deep(.drum-window),.profile-slide__title-ribbon,.profile-slide__dan-badge,.profile-slide__orbit i { animation:none!important; } }
</style>
