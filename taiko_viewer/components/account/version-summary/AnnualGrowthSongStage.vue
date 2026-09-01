<script setup lang="ts">
import { ref, watch } from "vue";
import AnnualArtworkFallback from "./AnnualArtworkFallback.vue";

const props = withDefaults(defineProps<{
  imageUrl?: string | null;
  imageAlt?: string;
  fallback?: string;
  tone?: "near" | "challenge";
  size?: "medium" | "large";
  active?: boolean;
  reducedMotion?: boolean;
  saveData?: boolean;
}>(), {
  imageUrl: null,
  imageAlt: "",
  fallback: "2026",
  tone: "near",
  size: "large",
  active: false,
  reducedMotion: false,
  saveData: false
});

const imageFailed = ref(false);
watch(() => props.imageUrl, () => { imageFailed.value = false; });
</script>

<template>
  <div class="growth-song-stage" :class="[`growth-song-stage--${tone}`, `growth-song-stage--${size}`, { 'is-active': active, 'is-reduced': reducedMotion, 'is-save-data': saveData }]">
    <div class="growth-song-stage__halo" aria-hidden="true" />
    <div class="growth-song-stage__orbit" aria-hidden="true"><i /><i /><i /></div>
    <div class="growth-song-stage__rim" aria-hidden="true">
      <i v-for="index in 24" :key="index" class="growth-song-stage__tick" :class="{ 'is-final-tick': index === 24 }" :style="{ '--turn': `${index * 15}deg` }"><span class="growth-song-stage__tick-mark" /></i>
    </div>
    <div v-if="tone === 'near'" class="growth-song-stage__prism-rim" aria-hidden="true"><i class="growth-song-stage__prism-sweep" /></div>
    <div v-else class="growth-song-stage__impact-rings" aria-hidden="true"><i class="growth-song-stage__impact-ring" /><i class="growth-song-stage__impact-ring" /></div>
    <div class="growth-song-stage__membrane">
      <img v-if="imageUrl && !imageFailed" :src="imageUrl" :alt="imageAlt" class="growth-song-stage__image" width="460" height="460" loading="lazy" decoding="async" @error="imageFailed = true">
      <AnnualArtworkFallback v-else kind="cover" :label="fallback" mark="2026" />
    </div>
    <span class="growth-song-stage__label" aria-hidden="true">SONG STAGE · 2026</span>
  </div>
</template>

<style scoped>
.growth-song-stage {
  --stage-size: min(42vh, 360px);
  position: relative;
  width: var(--stage-size);
  max-width: 100%;
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  transform-origin: 50% 50%;
}

.growth-song-stage--medium { --stage-size: min(34vh, 280px); }
.growth-song-stage--large { --stage-size: min(48vh, 430px); }

.growth-song-stage__halo {
  position: absolute;
  inset: -17%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(103, 198, 255, .27), rgba(103, 198, 255, .08) 42%, transparent 69%);
  opacity: .78;
}

.growth-song-stage--challenge .growth-song-stage__halo {
  inset: -23%;
  background: radial-gradient(circle, rgba(39, 120, 215, .34), rgba(39, 120, 215, .09) 44%, transparent 71%);
}

.growth-song-stage__orbit {
  position: absolute;
  inset: -6%;
  border-radius: 50%;
  transform-origin: 50% 50%;
  pointer-events: none;
}

.growth-song-stage__orbit i {
  position: absolute;
  inset: 0;
  border: 1px solid rgba(91, 211, 242, .17);
  border-radius: 50%;
  transform-origin: 50% 50%;
}

.growth-song-stage__orbit i:nth-child(2) { inset: 7%; border-style: dashed; }
.growth-song-stage__orbit i:nth-child(3) { inset: 14%; border-color: rgba(102, 216, 255, .16); }

.growth-song-stage__rim {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: conic-gradient(from -8deg, #276fbc 0deg 19deg, transparent 19deg 28deg, #4ba7e6 28deg 48deg, transparent 48deg 58deg, #276fbc 58deg 83deg, transparent 83deg 94deg, #4ba7e6 94deg 119deg, transparent 119deg 130deg, #276fbc 130deg 159deg, transparent 159deg 170deg, #4ba7e6 170deg 196deg, transparent 196deg 207deg, #276fbc 207deg 236deg, transparent 236deg 248deg, #4ba7e6 248deg 273deg, transparent 273deg 284deg, #276fbc 284deg 315deg, transparent 315deg 326deg, #4ba7e6 326deg 352deg, transparent 352deg);
  box-shadow: 0 24px 55px rgba(31, 88, 148, .2), 0 0 0 1px rgba(255, 255, 255, .62);
}

.growth-song-stage--challenge .growth-song-stage__rim {
  background: conic-gradient(from 5deg, #0d4d97 0deg 22deg, transparent 22deg 31deg, #227ec2 31deg 53deg, transparent 53deg 65deg, #0d4d97 65deg 93deg, transparent 93deg 105deg, #227ec2 105deg 133deg, transparent 133deg 146deg, #0d4d97 146deg 177deg, transparent 177deg 190deg, #227ec2 190deg 221deg, transparent 221deg 234deg, #0d4d97 234deg 267deg, transparent 267deg 281deg, #227ec2 281deg 314deg, transparent 314deg 328deg, #0d4d97 328deg 360deg);
}

.growth-song-stage__tick {
  position: absolute;
  inset: 0;
  display: flex;
  justify-content: center;
  padding-top: 2px;
  transform: rotate(var(--turn));
}

.growth-song-stage__tick-mark {
  display: block;
  width: clamp(3px, 1.5%, 7px);
  height: clamp(12px, 4.3%, 19px);
  border-radius: 99px;
  background: rgba(255, 255, 255, .92);
  box-shadow: 0 0 7px rgba(200, 239, 255, .7);
}

.growth-song-stage--near .growth-song-stage__tick.is-final-tick .growth-song-stage__tick-mark {
  background: linear-gradient(180deg, #fff, #b9eeff);
  box-shadow: 0 0 11px rgba(183, 237, 255, .95);
}

.growth-song-stage__prism-rim {
  position: absolute;
  inset: -2.7%;
  overflow: hidden;
  border-radius: 50%;
  pointer-events: none;
  mask: radial-gradient(farthest-side, transparent calc(100% - 8px), #000 calc(100% - 7px) calc(100% - 3px), transparent calc(100% - 2px));
}

.growth-song-stage__prism-sweep {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  opacity: .52;
  background: conic-gradient(from 0deg, transparent 0 212deg, #68e8ff 222deg, #7f8cff 244deg, #d87cff 263deg, #ff7e98 282deg, #ffd66b 298deg, #7cf6b4 312deg, transparent 320deg 360deg);
  filter: drop-shadow(0 0 8px rgba(136, 218, 255, .56));
}

.growth-song-stage__impact-rings { position: absolute; inset: -3%; pointer-events: none; }
.growth-song-stage__impact-ring {
  position: absolute;
  inset: 0;
  border: 1px solid rgba(161, 224, 255, .76);
  border-radius: 50%;
  opacity: 0;
  box-shadow: 0 0 18px rgba(75, 169, 225, .28);
  transform-origin: 50% 50%;
}
.growth-song-stage__impact-ring:nth-child(2) { inset: -4%; }

.growth-song-stage__membrane {
  position: absolute;
  inset: 8.8%;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 50%;
  background: #deeffd;
  border: 2px solid rgba(20, 72, 128, .2);
  box-shadow: inset 0 0 36px rgba(22, 99, 166, .2), 0 0 0 6px rgba(247, 252, 255, .88);
}

.growth-song-stage__image { width: 100%; height: 100%; object-fit: cover; }
.growth-song-stage__label {
  position: absolute;
  right: -5%;
  bottom: 2%;
  color: rgba(180, 223, 255, .56);
  font: 800 9px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: .12em;
  writing-mode: vertical-rl;
}

.growth-song-stage--challenge .growth-song-stage__label { color: rgba(158, 211, 255, .54); }

.growth-song-stage--near.is-active:not(.is-reduced):not(.is-save-data) .growth-song-stage__prism-sweep {
  animation: growth-prism-return 6s ease-in-out 2.1s infinite;
}

.growth-song-stage--near.is-active:not(.is-reduced):not(.is-save-data) .growth-song-stage__halo {
  animation: growth-near-breathe 8s ease-in-out 1.8s infinite;
}

.growth-song-stage--near.is-active:not(.is-reduced):not(.is-save-data) .growth-song-stage__orbit i:nth-child(2) {
  animation: growth-near-orbit-breathe 6.4s ease-in-out 2.2s infinite;
}

.growth-song-stage--challenge.is-active:not(.is-reduced):not(.is-save-data) .growth-song-stage__halo {
  animation: growth-challenge-knock 4.6s ease-in-out 1.7s infinite;
}

.growth-song-stage.is-save-data .growth-song-stage__halo { opacity: .45; }
.growth-song-stage.is-reduced *,
.growth-song-stage.is-save-data * { animation: none !important; transition: none !important; }
.growth-song-stage.is-reduced .growth-song-stage__halo { opacity: .55; }
.growth-song-stage--near.is-reduced .growth-song-stage__prism-sweep,
.growth-song-stage--near.is-save-data .growth-song-stage__prism-sweep { opacity: .62; transform: rotate(24deg); }

@keyframes growth-prism-return {
  0%, 78%, 100% { transform: rotate(50deg); opacity: .42; }
  86% { transform: rotate(132deg); opacity: .82; }
  92% { transform: rotate(166deg); opacity: .46; }
}

@keyframes growth-near-breathe {
  0%, 82%, 100% { transform: scale(1); opacity: .7; }
  89% { transform: scale(1.025); opacity: .88; }
}

@keyframes growth-near-orbit-breathe {
  0%, 80%, 100% { opacity: .34; transform: rotate(0deg); }
  88% { opacity: .7; transform: rotate(18deg); }
}

@keyframes growth-challenge-knock {
  0%, 72%, 100% { transform: scale(1); opacity: .64; }
  77% { transform: scale(1.035); opacity: .95; }
  81% { transform: scale(1); opacity: .7; }
  85% { transform: scale(1.025); opacity: .9; }
  89% { transform: scale(1); opacity: .66; }
}

@media (max-width: 720px) {
  .growth-song-stage { --stage-size: min(33vh, 47vw, 235px); }
  .growth-song-stage--medium { --stage-size: min(28vh, 38vw, 175px); }
  .growth-song-stage--large { --stage-size: min(35vh, 51vw, 245px); }
  .growth-song-stage__label { right: -8%; font-size: 8px; }
}

@media (prefers-reduced-motion: reduce) {
  .growth-song-stage * { animation: none !important; transition: none !important; }
}
</style>
