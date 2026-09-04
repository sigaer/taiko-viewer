<script setup lang="ts">
import { onMounted, ref } from 'vue';
const props = withDefaults(defineProps<{ coverUrl?: string | null; coverAlt?: string; centerText?: string; recordSrc?: string; active?: boolean; reducedMotion?: boolean; tone?: 'light'|'dark' }>(), { active: false, reducedMotion: false, tone: 'dark' });
const failed = ref(false);
const loaded = ref(false);
const saveData = ref(false);
onMounted(() => { saveData.value = Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData); });
</script>
<template>
  <div class="vinyl" :class="[`vinyl--${props.tone}`, { 'is-active': active, 'is-reduced': reducedMotion || saveData, 'has-center-text': centerText }]" data-animate>
    <div class="vinyl__disc"><img v-if="recordSrc" class="vinyl__asset" :src="recordSrc" alt="" aria-hidden="true"><div v-else class="vinyl__grooves" /><div v-if="!recordSrc" class="vinyl__shine" />
      <div class="vinyl__label">
        <img v-if="coverUrl && !failed" :class="{ 'is-loaded': loaded }" :src="coverUrl" :alt="coverAlt || ''" loading="lazy" @load="loaded = true" @error="failed = true" />
        <span v-else>{{ centerText || '♪' }}</span>
      </div>
    </div>
  </div>
</template>
<style scoped>
.vinyl{width:min(86vw,560px);aspect-ratio:1;position:relative;display:grid;place-items:center;transform:translateY(24px) scale(.88);opacity:.7;transition:transform .85s cubic-bezier(.16,1,.3,1),opacity .65s ease}.vinyl.is-active{transform:none;opacity:1}.vinyl__disc{position:relative;width:100%;height:100%;border-radius:50%;background:#090a0d;box-shadow:0 26px 52px #0008,inset 0 0 0 2px #ffffff18;overflow:hidden;animation:vinyl-spin 11s linear infinite}.vinyl__grooves{position:absolute;inset:4%;border-radius:50%;background:repeating-radial-gradient(circle at center,#ffffff25 0 1px,#0000 1px 7px);opacity:.9}.vinyl__shine{position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 205deg,#fff0 0 13%,#fff4 18%,#fff0 25% 61%,#fff3 68%,#fff0 76%);mix-blend-mode:screen}.vinyl__label{position:absolute;inset:27%;border-radius:50%;overflow:hidden;display:grid;place-items:center;background:radial-gradient(circle at 35% 30%,#ffdf9b,#a94754 55%,#312047);box-shadow:0 0 0 9px #0a0a0d,0 0 0 11px #fff2}.vinyl__label img{width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .25s ease}.vinyl__label img.is-loaded{opacity:1}.vinyl__label span{font:800 clamp(2.2rem,9vw,5rem)/1 var(--viewer-display-font);color:#fff;text-shadow:0 2px 12px #0008}.vinyl.has-center-text .vinyl__label{animation:vinyl-counter-spin 11s linear infinite}.vinyl--light .vinyl__disc{background:#11131a}.vinyl--light .vinyl__label{background:#d7e55f;color:#182118}.vinyl--light .vinyl__label span{color:#182118;text-shadow:none}@keyframes vinyl-spin{to{transform:rotate(360deg)}}@keyframes vinyl-counter-spin{to{transform:rotate(-360deg)}}
.vinyl__asset{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}.vinyl:has(.vinyl__asset) .vinyl__label{inset:35%;box-shadow:0 0 0 5px #12080c}.vinyl:has(.vinyl__asset) .vinyl__disc{background:transparent;box-shadow:0 26px 58px #0008;overflow:visible}.vinyl.is-reduced .vinyl__disc,.vinyl.is-reduced .vinyl__label{animation:none}@media(prefers-reduced-motion:reduce){.vinyl__disc,.vinyl__label{animation:none}}
.vinyl.is-reduced .vinyl__disc,.vinyl.is-reduced .vinyl__label{animation:none}@media(prefers-reduced-motion:reduce){.vinyl__disc,.vinyl__label{animation:none}}
</style>
