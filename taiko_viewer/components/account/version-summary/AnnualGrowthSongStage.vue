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
  <div class="growth-song-stage" :class="[`growth-song-stage--${tone}`, `growth-song-stage--${size}`, { 'is-active': active, 'is-reduced': reducedMotion, 'is-save-data': saveData }]" data-annual-stage="visual">
    <div class="growth-song-stage__halo" aria-hidden="true" />
    <div class="growth-song-stage__rim" aria-hidden="true">
      <i v-for="index in 24" :key="index" :style="{ '--turn': `${index * 15}deg` }" />
    </div>
    <div class="growth-song-stage__membrane">
      <img v-if="imageUrl && !imageFailed" :src="imageUrl" :alt="imageAlt" class="growth-song-stage__image" width="460" height="460" loading="lazy" decoding="async" @error="imageFailed = true">
      <AnnualArtworkFallback v-else kind="cover" :label="fallback" mark="2026" />
    </div>
    <span class="growth-song-stage__label" aria-hidden="true">SONG STAGE · 2026</span>
  </div>
</template>

<style scoped>
.growth-song-stage{--stage-size:min(42vh,360px);position:relative;width:var(--stage-size);max-width:100%;aspect-ratio:1;display:grid;place-items:center;flex:0 0 auto}.growth-song-stage--medium{--stage-size:min(34vh,280px)}.growth-song-stage--large{--stage-size:min(48vh,430px)}.growth-song-stage__halo{position:absolute;inset:-17%;border-radius:50%;background:radial-gradient(circle,rgba(103,198,255,.28),rgba(103,198,255,.08) 42%,transparent 69%);opacity:.8}.growth-song-stage--challenge .growth-song-stage__halo{inset:-23%;background:radial-gradient(circle,rgba(39,120,215,.34),rgba(39,120,215,.09) 44%,transparent 71%)}.growth-song-stage__rim{position:absolute;inset:0;border-radius:50%;background:conic-gradient(from -8deg,#276fbc 0deg 19deg,transparent 19deg 28deg,#4ba7e6 28deg 48deg,transparent 48deg 58deg,#276fbc 58deg 83deg,transparent 83deg 94deg,#4ba7e6 94deg 119deg,transparent 119deg 130deg,#276fbc 130deg 159deg,transparent 159deg 170deg,#4ba7e6 170deg 196deg,transparent 196deg 207deg,#276fbc 207deg 236deg,transparent 236deg 248deg,#4ba7e6 248deg 273deg,transparent 273deg 284deg,#276fbc 284deg 315deg,transparent 315deg 326deg,#4ba7e6 326deg 352deg,transparent 352deg);box-shadow:0 24px 55px rgba(31,88,148,.2),0 0 0 1px rgba(255,255,255,.62)}.growth-song-stage--challenge .growth-song-stage__rim{background:conic-gradient(from 5deg,#0d4d97 0deg 22deg,transparent 22deg 31deg,#227ec2 31deg 53deg,transparent 53deg 65deg,#0d4d97 65deg 93deg,transparent 93deg 105deg,#227ec2 105deg 133deg,transparent 133deg 146deg,#0d4d97 146deg 177deg,transparent 177deg 190deg,#227ec2 190deg 221deg,transparent 221deg 234deg,#0d4d97 234deg 267deg,transparent 267deg 281deg,#227ec2 281deg 314deg,transparent 314deg 328deg,#0d4d97 328deg 360deg)}.growth-song-stage__rim i{position:absolute;inset:0;display:flex;justify-content:center;padding-top:2px;transform:rotate(var(--turn))}.growth-song-stage__rim i::before{content:"";width:clamp(3px,1.5%,7px);height:clamp(12px,4.3%,19px);border-radius:99px;background:rgba(255,255,255,.92);box-shadow:0 0 7px rgba(200,239,255,.7)}.growth-song-stage__membrane{position:absolute;inset:8.8%;display:grid;place-items:center;overflow:hidden;border-radius:50%;background:#deeffd;border:2px solid rgba(20,72,128,.2);box-shadow:inset 0 0 36px rgba(22,99,166,.2),0 0 0 6px rgba(247,252,255,.88)}.growth-song-stage__image{width:100%;height:100%;object-fit:cover}.growth-song-stage__label{position:absolute;right:-5%;bottom:2%;color:rgba(27,91,153,.58);font:800 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em;writing-mode:vertical-rl}.growth-song-stage--challenge .growth-song-stage__label{color:rgba(18,65,120,.64)}.growth-song-stage.is-active:not(.is-reduced):not(.is-save-data) .growth-song-stage__halo{animation:growth-halo-breathe 3.8s ease-in-out infinite}.growth-song-stage.is-active:not(.is-reduced):not(.is-save-data) .growth-song-stage__rim{animation:growth-rim-turn 22s linear infinite}.growth-song-stage.is-active:not(.is-reduced) .growth-song-stage__membrane{animation:growth-membrane-in .8s cubic-bezier(.2,.8,.24,1) both}.growth-song-stage--challenge.is-active:not(.is-reduced) .growth-song-stage__membrane{animation:growth-membrane-press .9s cubic-bezier(.18,.84,.24,1) both}.growth-song-stage.is-save-data .growth-song-stage__halo{opacity:.45}.growth-song-stage.is-save-data .growth-song-stage__rim{animation:none}.growth-song-stage.is-reduced *{animation:none!important}.growth-song-stage.is-reduced .growth-song-stage__halo{opacity:.55}@keyframes growth-halo-breathe{50%{transform:scale(1.06);opacity:1}}@keyframes growth-rim-turn{to{transform:rotate(360deg)}}@keyframes growth-membrane-in{from{transform:scale(.82);opacity:.2;filter:brightness(.7)}to{transform:scale(1);opacity:1;filter:none}}@keyframes growth-membrane-press{from{transform:scale(.74);opacity:.15}55%{transform:scale(1.04)}to{transform:scale(1);opacity:1}}@media(max-width:720px){.growth-song-stage{--stage-size:min(33vh,47vw,235px)}.growth-song-stage--medium{--stage-size:min(28vh,38vw,175px)}.growth-song-stage--large{--stage-size:min(35vh,51vw,245px)}.growth-song-stage__label{font-size:8px;right:-8%}}@media(prefers-reduced-motion:reduce){.growth-song-stage *{animation:none!important}}
</style>
