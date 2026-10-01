<script setup lang="ts">
import { computed, ref, toRef } from "vue";
import type { AnnualMotionEffectScope } from "~/composables/useAnnualTimeline";
import { useAnnualTimeline } from "~/composables/useAnnualTimeline";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import { hasUsableText, isUsableMetric, segmentAnnualTitle } from "~/utils/annualPresentation";
import AnnualScene from "../AnnualScene.vue";
import FavoriteSongMemoryCopy from "../FavoriteSongMemoryCopy.vue";
import FavoriteSongOrbitDecor from "../FavoriteSongOrbitDecor.vue";
import FavoriteSongPlayCountRing from "../FavoriteSongPlayCountRing.vue";
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
const isJapanese = computed(() => locale.value === "ja");
const songName = computed(() => hasSong.value ? song.value!.name : isJapanese.value ? "この曲" : "这首歌");
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
      cueLine1: "",
      cueLine2: "",
      reveal: props.summary.snapshotAsOf ? "お気に入りの曲" : "年間シングル",
      playLabel: props.summary.snapshotAsOf ? "これまでにプレイした" : "この一年、戻ってきた",
      playUnit: "回",
      fallback: "2026"
    }
  : {
      cue: "",
      cueLine1: "有些歌不是路过，",
      cueLine2: "是你一次次回头。",
      reveal: props.summary.snapshotAsOf ? "最常玩的歌" : "年度单曲",
      playLabel: props.summary.snapshotAsOf ? "累计回来过" : "这一年，你回来过",
      playUnit: "次",
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
      <FavoriteSongOrbitDecor :active="active" :reduced-motion="reducedMotion" />
      <ParticleLayer :active="active" :reduced-motion="reducedMotion" density="low" palette="rainbow" />
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

    <template #copy>
      <header class="favorite-song-scene__intro">
        <span class="favorite-song-scene__eyebrow" data-annual-stage="title">
          <i aria-hidden="true" />{{ summary.copy.favoriteSong.eyebrow }} · {{ uiText.reveal }}<i aria-hidden="true" />
        </span>
        <p data-annual-stage="title">
          <template v-if="isJapanese">{{ uiText.cue }}</template>
          <template v-else>{{ uiText.cueLine1 }}<br />{{ uiText.cueLine2 }}</template>
        </p>
      </header>

      <div class="favorite-closing-stack">
        <div class="favorite-song-scene__song-copy" data-annual-stage="data">
          <h1 :class="songNameClass">{{ songName }}</h1>
        </div>

        <FavoriteSongPlayCountRing
          v-if="hasPlayCount"
          class="favorite-song-scene__play-count"
          data-annual-stage="data"
          :play-count="song?.playCount || 0"
          :active="active"
          :reduced-motion="reducedMotion"
          :label="uiText.playLabel"
          :unit="uiText.playUnit"
          @complete="onNumberComplete"
        />

        <FavoriteSongMemoryCopy
          class="favorite-song-scene__closing"
          data-annual-stage="copy"
          :is-japanese="isJapanese"
          :has-song="hasSong"
          :fallback="summary.copy.favoriteSong.body"
        />
      </div>

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
    </template>
  </AnnualScene>
</template>

<style scoped>
.favorite-song-scene { --song-ink:#020817; --song-deep:#06263a; --song-cyan:#62d9d0; --song-gold:#f5d377; --song-ivory:#fff7e8; --favorite-cover-size:clamp(268px,69vw,296px); --favorite-cover-top:clamp(178px,21.2dvh,202px); --favorite-cover-center-y:calc(var(--favorite-cover-top) + var(--favorite-cover-size) / 2); --favorite-count-size:clamp(136px,35vw,150px); --favorite-stack-top:calc(var(--favorite-cover-top) + var(--favorite-cover-size) + 16px); width:100%; height:100vh; height:100svh; height:100dvh; color:#fff; background:var(--song-ink); }
.favorite-song-scene__backdrop,.favorite-song-scene__cover-wash,.favorite-song-scene__color-wash,.favorite-song-scene__scrim { position:absolute; inset:0; }
.favorite-song-scene__backdrop { overflow:hidden; background:radial-gradient(circle at 50% 34%,#0b5265 0,#082b43 30%,#071a31 52%,#020817 82%); }
.favorite-song-scene__cover-wash { inset:8% -18% 28%; background-position:center; background-size:cover; filter:blur(28px) saturate(1.18) brightness(.42); opacity:.22; transform:scale(1.1); }
.favorite-song-scene__color-wash { background:radial-gradient(circle at 50% 37%,rgba(77,213,208,.18),transparent 31%),radial-gradient(circle at 24% 64%,rgba(26,99,142,.16),transparent 31%),linear-gradient(180deg,rgba(3,21,38,.04),rgba(2,8,23,.36) 66%,rgba(1,5,16,.86)); mix-blend-mode:screen; }
.favorite-song-scene__scrim { background:linear-gradient(180deg,rgba(2,8,23,.12),rgba(2,10,25,.02) 38%,rgba(2,8,23,.32) 69%,rgba(1,5,16,.82) 100%),radial-gradient(ellipse at 50% 41%,transparent 0 34%,rgba(1,6,18,.42) 83%); }
.favorite-song-scene__grooves { position:absolute; left:50%; top:var(--favorite-cover-center-y); width:min(118vw,548px); aspect-ratio:1; transform:translate(-50%,-50%); border:1px solid rgba(126,222,226,.08); border-radius:50%; box-shadow:0 0 74px rgba(60,198,205,.12); }
.favorite-song-scene__grooves i { position:absolute; inset:calc(7% + var(--ring,0) * 8%); border:1px solid rgba(160,225,234,.08); border-radius:50%; }
.favorite-song-scene__grooves i:nth-child(2) { --ring:1; border-style:dashed; border-color:rgba(245,211,119,.14); }
.favorite-song-scene__grooves i:nth-child(3) { --ring:2; }
.favorite-song-scene__hero-cue { position:absolute; inset:0; display:grid; justify-items:center; align-items:start; padding-top:var(--favorite-cover-top); }
.favorite-song-scene__hero-cue :deep(.song-cover-hero) { width:var(--favorite-cover-size); }
.favorite-song-scene__intro { position:absolute; top:max(clamp(58px,7.1dvh,68px),calc(env(safe-area-inset-top) + 50px)); left:8%; right:8%; text-align:center; }
.favorite-song-scene__eyebrow { display:flex; align-items:center; justify-content:center; gap:10px; color:var(--song-gold); font:800 clamp(10px,2.7vw,12px)/1.2 var(--viewer-font-family); letter-spacing:.15em; }
.favorite-song-scene__eyebrow i { width:12px; height:1px; background:linear-gradient(90deg,transparent,var(--song-gold)); box-shadow:0 0 8px rgba(245,211,119,.44); }
.favorite-song-scene__eyebrow i:last-child { transform:scaleX(-1); }
.favorite-song-scene__intro p { max-width:19rem; margin:14px auto 0; color:var(--song-ivory); font:500 clamp(1.3rem,5.7vw,1.65rem)/1.48 var(--viewer-font-family); letter-spacing:.035em; text-shadow:0 4px 22px rgba(0,5,18,.76); text-wrap:balance; }
.favorite-closing-stack { position:absolute; left:0; right:0; top:var(--favorite-stack-top); bottom:0; z-index:3; display:flex; flex-direction:column; align-items:center; gap:clamp(16px,2.2vh,22px); padding-bottom:max(92px,calc(env(safe-area-inset-bottom) + 78px)); box-sizing:border-box; }
.favorite-song-scene__song-copy { width:100%; text-align:center; }
.favorite-song-scene__credits { display:flex; justify-content:center; flex-wrap:wrap; gap:6px; min-height:18px; }
.favorite-song-scene__credits span { max-width:min(72vw,24rem); padding:4px 9px; overflow-wrap:anywhere; border:1px solid rgba(190,228,235,.3); border-radius:999px; color:rgba(231,242,242,.8); background:rgba(2,12,28,.62); box-shadow:0 5px 16px rgba(0,4,16,.25); font:700 clamp(10px,2.65vw,12px)/1.15 ui-monospace,SFMono-Regular,Menlo,monospace; }
.favorite-song-scene__song-copy h1 { max-width:14ch; margin:8px auto 0; overflow-wrap:anywhere; color:var(--song-ivory); font:850 clamp(2.05rem,9.6vw,3.15rem)/.98 var(--viewer-display-font); letter-spacing:-.035em; text-shadow:0 5px 26px rgba(0,3,18,.92),0 0 24px rgba(98,217,208,.18); text-wrap:balance; }
.favorite-song-scene__song-copy h1.is-compact { max-width:18ch; font-size:clamp(1.58rem,7.2vw,2.5rem); line-height:1.04; }
.favorite-song-scene__song-copy h1.is-long { max-width:22ch; font-size:clamp(1.24rem,5.7vw,2rem); line-height:1.12; }
.favorite-song-scene__play-count { flex:0 0 auto; }
.favorite-song-scene__closing { flex:0 0 auto; padding-left:8%; padding-right:8%; }
.favorite-song-scene__counter { position:absolute; left:5%; bottom:max(16px,env(safe-area-inset-bottom)); color:rgba(185,221,236,.52); font:800 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace; }
.favorite-song-scene__ripple { z-index:1; }
.favorite-song-scene.is-active:not(.is-reduced) .favorite-song-scene__grooves i:nth-child(2) { animation:favorite-groove-turn 5.2s cubic-bezier(.2,.65,.25,1) .7s 1 both; }
@keyframes favorite-groove-turn { to { transform:rotate(360deg); } }
@media (max-height:820px) and (orientation:portrait) { .favorite-song-scene { --favorite-cover-size:min(54vw,30vh); --favorite-cover-top:clamp(110px,15dvh,132px); --favorite-count-size:clamp(96px,27vw,116px); } .favorite-song-scene__intro { top:max(38px,calc(env(safe-area-inset-top) + 36px)); } .favorite-song-scene__intro p { margin-top:6px; font-size:clamp(0.98rem,4.6vw,1.2rem); line-height:1.32; } .favorite-song-scene__song-copy h1 { margin-top:4px; font-size:clamp(1.4rem,7vw,2rem); } .favorite-song-scene__song-copy h1.is-compact { font-size:clamp(1.15rem,5.8vw,1.6rem); } .favorite-song-scene__song-copy h1.is-long { font-size:clamp(1rem,4.8vw,1.35rem); } .favorite-closing-stack { padding-bottom:max(84px,calc(env(safe-area-inset-bottom) + 72px)); } }
@media (max-height:700px) and (orientation:portrait) { .favorite-song-scene { --favorite-cover-size:min(62vw,34vh); --favorite-cover-top:clamp(146px,20.5dvh,164px); --favorite-count-size:clamp(106px,29.5vw,118px); } .favorite-song-scene__intro { top:max(44px,calc(env(safe-area-inset-top) + 42px)); } .favorite-song-scene__intro p { margin-top:8px; font-size:clamp(1.02rem,4.8vw,1.25rem); line-height:1.35; } .favorite-song-scene__song-copy h1 { margin-top:5px; font-size:clamp(1.48rem,7.6vw,2.15rem); } .favorite-song-scene__song-copy h1.is-compact { font-size:clamp(1.22rem,6.2vw,1.75rem); } .favorite-song-scene__song-copy h1.is-long { font-size:clamp(1.02rem,5vw,1.45rem); } }
@media (max-height:600px) and (orientation:portrait) { .favorite-song-scene { --favorite-cover-top:116px; } .favorite-closing-stack { gap:8px; } }
@media (orientation:landscape) and (max-height:460px) { .favorite-song-scene { --favorite-cover-size:min(30vw,65vh,280px); --favorite-cover-top:0px; --favorite-cover-center-y:50%; --favorite-count-size:min(25vh,112px); } .favorite-song-scene__grooves { top:50%; left:27%; width:min(43vw,82vh); } .favorite-song-scene__hero-cue { right:52%; padding:0; place-items:center; } .favorite-song-scene__intro { top:9%; left:50%; right:6%; text-align:left; } .favorite-song-scene__eyebrow { justify-content:flex-start; } .favorite-song-scene__intro p { margin:8px 0 0; font-size:clamp(1rem,2.6vw,1.25rem); } .favorite-closing-stack { left:50%; right:6%; top:31%; align-items:flex-start; text-align:left; padding-bottom:max(52px,calc(env(safe-area-inset-bottom) + 44px)); } .favorite-song-scene__song-copy { width:100%; text-align:left; } .favorite-song-scene__credits { justify-content:flex-start; } .favorite-song-scene__song-copy h1,.favorite-song-scene__song-copy h1.is-compact,.favorite-song-scene__song-copy h1.is-long { max-width:100%; margin-left:0; font-size:clamp(1.45rem,4.2vw,2.55rem); } .favorite-song-scene__counter { left:3%; } }
@media (prefers-reduced-motion:reduce) { .favorite-song-scene * { animation:none!important; } }
</style>
