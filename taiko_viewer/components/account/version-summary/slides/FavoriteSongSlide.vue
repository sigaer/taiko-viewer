<script setup lang="ts">
import { computed, ref, toRef } from "vue";
import type { AnnualMotionEffectScope } from "~/composables/useAnnualTimeline";
import { useAnnualTimeline } from "~/composables/useAnnualTimeline";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import { hasUsableText, isUsableMetric, segmentAnnualTitle } from "~/utils/annualPresentation";
import AnimatedNumber from "../AnimatedNumber.vue";
import AnnualScene from "../AnnualScene.vue";
import ParticleLayer from "../ParticleLayer.vue";
import SongCoverHero from "../SongCoverHero.vue";
import TaikoRipple from "../TaikoRipple.vue";

const props = defineProps<{
  summary: VersionSummaryViewModel;
  pageIndex: number;
  pageTotal: number;
  active: boolean;
  reducedMotion: boolean;
}>();

const { locale } = useI18n();
const rootRef = ref<HTMLElement | null>(null);
const song = computed(() => props.summary.favoriteSong);
const hasSong = computed(() => Boolean(song.value && hasUsableText(song.value.name)));
const hasPlayCount = computed(() => isUsableMetric(song.value?.playCount));
const songName = computed(() => hasSong.value ? song.value!.name : props.summary.copy.favoriteSong.title);
const songNameClass = computed(() => {
  const length = segmentAnnualTitle(songName.value).length;
  return length > 30 ? "is-long" : length > 19 ? "is-compact" : "";
});
const coverBackgroundStyle = computed(() => song.value?.coverUrl
  ? { backgroundImage: `url("${song.value.coverUrl.replaceAll('"', '\\"')}")` }
  : undefined);
const feedbackTrigger = ref(0);
const coverImpact = ref(false);
let motionScope: AnnualMotionEffectScope | null = null;

const uiText = computed(() => locale.value === "ja"
  ? {
      cue: "通り過ぎるだけではなく、何度も戻ってしまう曲がある。",
      reveal: "年間シングル",
      playLabel: "このバージョンで戻った",
      playUnit: "回",
      closing: "この曲も、きっとあなたの鼓点を覚えています。",
      fallback: "2026"
    }
  : {
      cue: "有些歌不是路过，是你一次次回头。",
      reveal: "年度单曲",
      playLabel: "这一版，你回来了",
      playUnit: "次",
      closing: "它大概已经很熟悉你的鼓点了。",
      fallback: "2026"
    });

const { onAnnualMotionActive } = useAnnualTimeline(
  rootRef,
  toRef(props, "active"),
  toRef(props, "reducedMotion"),
  { reenter: "restart" }
);

onAnnualMotionActive((scope) => {
  motionScope = scope;
  return () => {
    motionScope = null;
    coverImpact.value = false;
  };
});

const onNumberComplete = () => {
  if (!props.active || props.reducedMotion || !hasPlayCount.value || !motionScope) return;
  coverImpact.value = true;
  feedbackTrigger.value += 1;
  motionScope.setTimeout(() => { coverImpact.value = false; }, 460);
};
</script>

<template>
  <AnnualScene
    ref="rootRef"
    class="favorite-song-scene"
    mood="cover-spectrum"
    intensity="high"
    :active="active"
    :reduced-motion="reducedMotion"
    :aria-label="summary.copy.favoriteSong.title"
  >
    <template #background>
      <div class="favorite-song-scene__backdrop">
        <div v-if="song?.coverUrl" class="favorite-song-scene__cover-wash" :style="coverBackgroundStyle" />
        <div class="favorite-song-scene__color-wash" />
        <div class="favorite-song-scene__scrim" />
      </div>
    </template>

    <template #atmosphere>
      <div class="favorite-song-scene__grooves" aria-hidden="true"><i /><i /><i /></div>
      <ParticleLayer :active="active" :reduced-motion="reducedMotion" density="low" palette="rainbow" />
      <div class="favorite-song-scene__notes" aria-hidden="true"><i>♪</i><i>♪</i><i>♪</i></div>
    </template>

    <template #visual>
      <div class="favorite-song-scene__hero-cue" data-annual-stage="visual">
        <SongCoverHero
          :cover-url="song?.coverUrl"
          :alt="songName"
          :fallback-label="uiText.fallback"
          :active="active"
          :reduced-motion="reducedMotion"
          :impact="coverImpact"
        />
      </div>
    </template>

    <template #data>
      <div v-if="hasPlayCount" class="favorite-song-scene__play-count" data-annual-stage="copy">
        <span>{{ uiText.playLabel }}</span>
        <strong>
          <AnimatedNumber
            :value="song?.playCount || 0"
            :active="active"
            :reduced-motion="reducedMotion"
            :delay="1850"
            :duration="820"
            @complete="onNumberComplete"
          />
          <em>{{ uiText.playUnit }}</em>
        </strong>
      </div>
    </template>

    <template #copy>
      <header class="favorite-song-scene__intro">
        <span data-annual-stage="title">{{ summary.copy.favoriteSong.eyebrow }} · {{ uiText.reveal }}</span>
        <p data-annual-stage="title">{{ uiText.cue }}</p>
      </header>

      <div class="favorite-song-scene__song-copy" data-annual-stage="data">
        <div class="favorite-song-scene__credits">
          <span v-if="hasUsableText(song?.subtitle)">{{ song?.subtitle }}</span>
          <span v-if="song?.songNo">#{{ song.songNo }}</span>
        </div>
        <h1 :class="songNameClass">{{ songName }}</h1>
      </div>

      <p class="favorite-song-scene__closing" data-annual-stage="copy">
        {{ hasSong ? uiText.closing : summary.copy.favoriteSong.body }}
      </p>
      <span class="favorite-song-scene__counter" data-annual-stage="copy">
        {{ String(pageIndex + 1).padStart(2, "0") }} / {{ String(pageTotal).padStart(2, "0") }}
      </span>
    </template>

    <template #transition>
      <TaikoRipple
        class="favorite-song-scene__ripple"
        :active="active"
        :reduced-motion="reducedMotion"
        :trigger="feedbackTrigger"
        mode="ambient"
        origin-x="50%"
        origin-y="42%"
      />
      <div class="favorite-song-scene__needle" aria-hidden="true" />
    </template>
  </AnnualScene>
</template>

<style scoped>
.favorite-song-scene { --song-ink:#050716; --song-violet:#4a2a74; --song-cyan:#6ed7f2; --song-gold:#f2cb72; width:100%; height:100vh; height:100svh; height:100dvh; color:#fff; background:var(--song-ink); }
.favorite-song-scene__backdrop,.favorite-song-scene__cover-wash,.favorite-song-scene__color-wash,.favorite-song-scene__scrim { position:absolute; inset:0; }
.favorite-song-scene__backdrop { overflow:hidden; background:radial-gradient(circle at 50% 38%,#294d77 0,#1b1941 42%,#050716 80%); }
.favorite-song-scene__cover-wash { inset:-10%; background-position:center; background-size:cover; filter:blur(34px) saturate(1.3) brightness(.58); opacity:.68; transform:scale(1.16); }
.favorite-song-scene__color-wash { background:radial-gradient(circle at 50% 34%,rgba(110,215,242,.25),transparent 31%),conic-gradient(from 218deg at 50% 42%,rgba(234,101,126,.22),rgba(242,203,114,.15),rgba(83,202,177,.15),rgba(91,132,219,.2),rgba(167,102,196,.24),rgba(234,101,126,.22)); mix-blend-mode:screen; opacity:.72; }
.favorite-song-scene__scrim { background:linear-gradient(180deg,rgba(4,6,18,.38),rgba(4,7,20,.08) 25%,rgba(3,6,18,.34) 58%,rgba(3,5,16,.94) 100%),radial-gradient(ellipse at 50% 42%,transparent 0 34%,rgba(2,4,14,.48) 78%); }
.favorite-song-scene__grooves { position:absolute; left:50%; top:38%; width:min(92vw,520px); aspect-ratio:1; transform:translate(-50%,-50%); border:1px solid rgba(215,239,249,.13); border-radius:50%; box-shadow:0 0 72px rgba(83,198,230,.16); }
.favorite-song-scene__grooves i { position:absolute; inset:calc(8% + var(--ring,0) * 9%); border:1px solid rgba(215,239,249,.1); border-radius:50%; }
.favorite-song-scene__grooves i:nth-child(2) { --ring:1; border-style:dashed; border-color:rgba(242,203,114,.18); }
.favorite-song-scene__grooves i:nth-child(3) { --ring:2; }
.favorite-song-scene__notes i { position:absolute; color:rgba(218,242,249,.3); font:700 clamp(1.2rem,5vw,2rem)/1 var(--viewer-display-font); font-style:normal; text-shadow:0 0 16px rgba(110,215,242,.24); }
.favorite-song-scene__notes i:nth-child(1) { top:27%; left:8%; transform:rotate(-14deg); }
.favorite-song-scene__notes i:nth-child(2) { top:18%; right:10%; transform:rotate(17deg); }
.favorite-song-scene__notes i:nth-child(3) { top:48%; right:5%; transform:rotate(-8deg); }
.favorite-song-scene__hero-cue { position:absolute; inset:0; display:grid; justify-items:center; align-items:start; padding-top:17vh; }
.favorite-song-scene__hero-cue :deep(.song-cover-hero) { width:min(64vw,370px); }
.favorite-song-scene__intro { position:absolute; top:max(5.2%,calc(env(safe-area-inset-top) + 12px)); left:8%; right:8%; text-align:center; }
.favorite-song-scene__intro>span { color:var(--song-gold); font:800 10px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.13em; text-transform:uppercase; }
.favorite-song-scene__intro p { max-width:28rem; margin:7px auto 0; color:rgba(226,241,249,.78); font:600 clamp(11px,3vw,13px)/1.5 var(--viewer-font-family); text-wrap:balance; }
.favorite-song-scene__song-copy { position:absolute; z-index:2; top:56.5%; left:6%; right:6%; text-align:center; }
.favorite-song-scene__credits { display:flex; justify-content:center; flex-wrap:wrap; gap:6px; min-height:18px; }
.favorite-song-scene__credits span { max-width:min(72vw,24rem); padding:3px 8px; overflow-wrap:anywhere; border:1px solid rgba(218,240,249,.18); border-radius:999px; color:rgba(218,240,249,.68); background:rgba(4,8,23,.24); font:700 10px/1.15 var(--viewer-font-family); }
.favorite-song-scene__song-copy h1 { max-width:13ch; margin:7px auto 0; overflow-wrap:anywhere; color:#fff7e8; font:800 clamp(2rem,9.2vw,4.35rem)/.98 var(--viewer-display-font); letter-spacing:-.035em; text-shadow:0 5px 26px rgba(0,3,18,.9),0 0 28px rgba(110,215,242,.22); text-wrap:balance; }
.favorite-song-scene__song-copy h1.is-compact { max-width:17ch; font-size:clamp(1.55rem,7.2vw,3.3rem); line-height:1.04; }
.favorite-song-scene__song-copy h1.is-long { max-width:21ch; font-size:clamp(1.22rem,5.7vw,2.5rem); line-height:1.12; }
.favorite-song-scene__play-count { position:absolute; z-index:3; top:43%; left:calc(50% + min(18vw,94px)); min-width:88px; color:rgba(224,241,248,.7); text-align:left; text-shadow:0 3px 18px rgba(0,3,18,.88); }
.favorite-song-scene__play-count::before { content:""; position:absolute; top:0; bottom:0; left:-9px; width:2px; background:linear-gradient(var(--song-gold),rgba(110,215,242,.18)); box-shadow:0 0 12px rgba(242,203,114,.34); }
.favorite-song-scene__play-count>span { display:block; font:700 10px/1.25 var(--viewer-font-family); }
.favorite-song-scene__play-count strong { display:flex; align-items:baseline; gap:4px; margin-top:2px; color:#fff0bd; font:800 clamp(1.9rem,8vw,3.1rem)/.88 var(--viewer-display-font); }
.favorite-song-scene__play-count em { color:rgba(242,203,114,.78); font:800 11px/1 var(--viewer-font-family); font-style:normal; }
.favorite-song-scene__closing { position:absolute; left:10%; right:10%; bottom:max(7%,calc(env(safe-area-inset-bottom) + 48px)); margin:0; color:rgba(221,238,246,.78); font:600 clamp(11px,3.1vw,13px)/1.55 var(--viewer-font-family); text-align:center; text-wrap:balance; }
.favorite-song-scene__counter { position:absolute; left:5%; bottom:max(16px,env(safe-area-inset-bottom)); color:rgba(185,221,236,.52); font:800 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace; }
.favorite-song-scene__ripple { z-index:1; }
.favorite-song-scene__needle { position:absolute; top:17%; left:calc(50% + min(31vw,178px)); width:1px; height:25%; transform:rotate(13deg); transform-origin:top; background:linear-gradient(rgba(242,203,114,.55),transparent); box-shadow:0 0 10px rgba(242,203,114,.2); }
.favorite-song-scene.is-active:not(.is-reduced) .favorite-song-scene__grooves i:nth-child(2) { animation:favorite-groove-turn 20s linear 1.8s infinite; }
.favorite-song-scene.is-active:not(.is-reduced) .favorite-song-scene__notes i { animation:favorite-note-echo 4.2s ease-in-out 2.3s infinite; }
.favorite-song-scene.is-active:not(.is-reduced) .favorite-song-scene__notes i:nth-child(2) { animation-delay:2.9s; }
.favorite-song-scene.is-active:not(.is-reduced) .favorite-song-scene__notes i:nth-child(3) { animation-delay:3.4s; }
@keyframes favorite-groove-turn { to { transform:rotate(360deg); } }
@keyframes favorite-note-echo { 0%,100% { opacity:.2; transform:translateY(0) rotate(-8deg); } 50% { opacity:.48; transform:translateY(-9px) rotate(4deg); } }
@media (max-height:700px) and (orientation:portrait) { .favorite-song-scene__hero-cue { padding-top:14vh; } .favorite-song-scene__hero-cue :deep(.song-cover-hero) { width:min(62vw,36vh); } .favorite-song-scene__song-copy { top:52.5%; } .favorite-song-scene__song-copy h1 { font-size:clamp(1.55rem,8vw,2.5rem); } .favorite-song-scene__song-copy h1.is-compact { font-size:clamp(1.28rem,6.5vw,2rem); } .favorite-song-scene__song-copy h1.is-long { font-size:clamp(1.08rem,5.2vw,1.65rem); } .favorite-song-scene__play-count { top:39%; } .favorite-song-scene__closing { bottom:max(6%,calc(env(safe-area-inset-bottom) + 40px)); } }
@media (orientation:landscape) and (max-height:460px) { .favorite-song-scene__grooves { top:50%; left:27%; width:min(43vw,82vh); } .favorite-song-scene__hero-cue { right:52%; padding:0; place-items:center; } .favorite-song-scene__hero-cue :deep(.song-cover-hero) { width:min(30vw,65vh,280px); } .favorite-song-scene__intro { top:9%; left:50%; right:6%; text-align:left; } .favorite-song-scene__intro p { margin-left:0; } .favorite-song-scene__song-copy { top:31%; left:50%; right:6%; text-align:left; } .favorite-song-scene__credits { justify-content:flex-start; } .favorite-song-scene__song-copy h1,.favorite-song-scene__song-copy h1.is-compact,.favorite-song-scene__song-copy h1.is-long { max-width:100%; margin-left:0; font-size:clamp(1.45rem,4.2vw,2.55rem); } .favorite-song-scene__play-count { top:61%; left:51%; } .favorite-song-scene__closing { left:50%; right:7%; bottom:9%; text-align:left; } .favorite-song-scene__counter { left:3%; } .favorite-song-scene__needle { top:8%; left:43%; height:38%; } }
@media (prefers-reduced-motion:reduce) { .favorite-song-scene * { animation:none!important; } }
</style>
