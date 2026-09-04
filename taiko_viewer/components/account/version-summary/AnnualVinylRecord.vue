<script setup lang="ts">
import { ref } from 'vue';
const props = withDefaults(defineProps<{ coverUrl?: string | null; coverAlt?: string; centerText?: string; active?: boolean; reducedMotion?: boolean; tone?: 'light'|'dark' }>(), { active: false, reducedMotion: false, tone: 'dark' });
const failed = ref(false);
</script>
<template>
  <div class="vinyl" :class="[`vinyl--${props.tone}`, { 'is-active': active, 'is-reduced': reducedMotion }]" data-animate>
    <div class="vinyl__disc"><div class="vinyl__grooves" /><div class="vinyl__shine" />
      <div class="vinyl__label">
        <img v-if="coverUrl && !failed" :src="coverUrl" :alt="coverAlt || ''" loading="lazy" @error="failed = true" />
        <span v-else>{{ centerText || '♪' }}</span>
      </div>
    </div>
  </div>
</template>
<style scoped>
.vinyl{width:min(86vw,560px);aspect-ratio:1;position:relative;display:grid;place-items:center;transform:translateY(10px) scale(.94);opacity:.92;transition:transform .8s cubic-bezier(.2,.8,.2,1),opacity .8s ease}.vinyl.is-active{transform:none;opacity:1}.vinyl__disc{position:relative;width:100%;height:100%;border-radius:50%;background:#090a0d;box-shadow:0 26px 52px #0008,inset 0 0 0 2px #ffffff18;overflow:hidden}.vinyl__grooves{position:absolute;inset:5%;border-radius:50%;background:repeating-radial-gradient(circle at center,#ffffff1c 0 1px,#0000 1px 8px);opacity:.8}.vinyl__shine{position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 210deg,#fff0 0 15%,#fff3 18%,#fff0 24% 63%,#fff2 69%,#fff0 75%);mix-blend-mode:screen;animation:shine 9s linear infinite}.vinyl__label{position:absolute;inset:27%;border-radius:50%;overflow:hidden;display:grid;place-items:center;background:radial-gradient(circle at 35% 30%,#ffdf9b,#a94754 55%,#312047);box-shadow:0 0 0 9px #0a0a0d,0 0 0 11px #fff2}.vinyl__label img{width:100%;height:100%;object-fit:cover}.vinyl__label span{font:800 clamp(2.2rem,9vw,5rem)/1 var(--viewer-display-font);color:#fff;text-shadow:0 2px 12px #0008}.vinyl--light .vinyl__disc{background:#11131a}.vinyl--light .vinyl__label{background:#d7e55f;color:#182118}.vinyl--light .vinyl__label span{color:#182118;text-shadow:none}@keyframes shine{to{transform:rotate(360deg)}}
.vinyl.is-reduced .vinyl__shine{animation:none}@media(prefers-reduced-motion:reduce){.vinyl__shine{animation:none}}
</style>
