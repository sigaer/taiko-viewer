<script setup lang="ts">
import { computed } from "vue";
import AnnualCover from "./AnnualCover.vue";

const props = withDefaults(defineProps<{
  coverUrl?: string | null;
  alt: string;
  fallbackLabel: string;
  active?: boolean;
  reducedMotion?: boolean;
  impact?: boolean;
}>(), {
  coverUrl: null,
  active: false,
  reducedMotion: false,
  impact: false
});

const fragmentStyle = computed(() => props.coverUrl
  ? { backgroundImage: `url("${props.coverUrl.replaceAll('"', '\\"')}")` }
  : undefined);
</script>

<template>
  <div
    class="song-cover-hero"
    :class="{ 'is-active': active, 'is-reduced': reducedMotion, 'is-impact': impact }"
  >
    <div class="song-cover-hero__record" aria-hidden="true"><i /><i /><i /></div>
    <div v-if="coverUrl" class="song-cover-hero__fragments" aria-hidden="true">
      <i v-for="index in 4" :key="index" :class="`is-${index}`" :style="fragmentStyle" />
    </div>
    <div class="song-cover-hero__float">
      <div class="song-cover-hero__frame">
        <AnnualCover :src="coverUrl" :alt="alt || fallbackLabel" class="song-cover-hero__artwork" />
        <span class="song-cover-hero__edge" aria-hidden="true" />
        <span class="song-cover-hero__shine" aria-hidden="true" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.song-cover-hero { position:relative; width:100%; aspect-ratio:1; perspective:900px; }
.song-cover-hero__record { position:absolute; inset:-14%; border-radius:50%; opacity:.58; background:repeating-radial-gradient(circle,transparent 0 8px,rgba(194,226,244,.12) 9px,transparent 10px 15px),radial-gradient(circle,rgba(110,215,242,.15),transparent 62%); box-shadow:0 0 70px rgba(88,197,230,.2); }
.song-cover-hero__record::before { content:""; position:absolute; inset:7%; border:1px solid rgba(242,203,114,.28); border-radius:50%; box-shadow:inset 0 0 42px rgba(110,215,242,.12),0 0 28px rgba(110,215,242,.12); }
.song-cover-hero__record i { position:absolute; inset:calc(16% + var(--ring,0) * 8%); border:1px solid rgba(211,238,250,.14); border-radius:50%; }
.song-cover-hero__record i:nth-child(2) { --ring:1; border-style:dashed; border-color:rgba(242,203,114,.24); }
.song-cover-hero__record i:nth-child(3) { --ring:2; }
.song-cover-hero__float,.song-cover-hero__frame { position:absolute; inset:0; }
.song-cover-hero__frame { overflow:hidden; border:1px solid rgba(237,247,252,.52); border-radius:clamp(14px,3.8vw,18px); background:linear-gradient(145deg,#132c4d,#532c70); box-shadow:0 28px 58px rgba(0,3,18,.58),0 0 0 5px rgba(8,16,37,.5),0 0 46px rgba(110,215,242,.2); transform-style:preserve-3d; }
.song-cover-hero__artwork { display:block; width:100%; height:100%; background:linear-gradient(145deg,#152d50,#6a3d7d 58%,#c77d7b); }
.song-cover-hero__artwork :deep(.el-image__inner) { width:100%; height:100%; object-fit:cover; }
.song-cover-hero__artwork :deep(.annual-artwork-fallback) { width:100%; height:100%; border-radius:inherit; }
.song-cover-hero__edge { position:absolute; inset:0; border-radius:inherit; box-shadow:inset 0 0 0 1px rgba(255,255,255,.22),inset 0 -22px 44px rgba(0,5,24,.22); pointer-events:none; }
.song-cover-hero__shine { position:absolute; top:-34%; left:-62%; width:42%; height:168%; transform:rotate(24deg); background:linear-gradient(90deg,transparent,rgba(255,255,255,.24),transparent); opacity:.72; pointer-events:none; }
.song-cover-hero__fragments { position:absolute; z-index:3; inset:0; pointer-events:none; transform-style:preserve-3d; }
.song-cover-hero__fragments i { position:absolute; width:50%; height:50%; background-size:200% 200%; box-shadow:0 18px 34px rgba(0,4,21,.44); opacity:0; }
.song-cover-hero__fragments .is-1 { top:0; left:0; border-radius:18px 0 0 0; background-position:0 0; --fragment-x:-64%; --fragment-y:-72%; --fragment-r:-18deg; }
.song-cover-hero__fragments .is-2 { top:0; right:0; border-radius:0 18px 0 0; background-position:100% 0; --fragment-x:72%; --fragment-y:-54%; --fragment-r:16deg; }
.song-cover-hero__fragments .is-3 { bottom:0; left:0; border-radius:0 0 0 18px; background-position:0 100%; --fragment-x:-72%; --fragment-y:66%; --fragment-r:14deg; }
.song-cover-hero__fragments .is-4 { right:0; bottom:0; border-radius:0 0 18px 0; background-position:100% 100%; --fragment-x:66%; --fragment-y:74%; --fragment-r:-15deg; }
.song-cover-hero.is-active:not(.is-reduced) .song-cover-hero__frame { animation:song-cover-lock 1.08s cubic-bezier(.18,.82,.22,1) .42s both; }
.song-cover-hero.is-active:not(.is-reduced) .song-cover-hero__fragments i { animation:song-cover-gather 1.12s cubic-bezier(.16,.82,.2,1) .28s both; }
.song-cover-hero.is-active:not(.is-reduced) .song-cover-hero__float { animation:song-cover-float 3.8s ease-in-out 1.7s 1 both; }
.song-cover-hero.is-active:not(.is-reduced) .song-cover-hero__record i:nth-child(2) { animation:song-cover-record-turn 5.2s cubic-bezier(.2,.65,.25,1) .7s 1 both; }
.song-cover-hero.is-active:not(.is-reduced) .song-cover-hero__shine { animation:song-cover-shine 3.8s ease-in-out 1.8s 1 both; }
.song-cover-hero.is-impact .song-cover-hero__artwork { animation:song-cover-impact .46s cubic-bezier(.18,.78,.25,1); }
@keyframes song-cover-lock { from { clip-path:inset(42% round 50%); transform:translate3d(0,12%,90px) rotateZ(-16deg) rotateX(12deg); filter:brightness(1.7) saturate(.45) blur(5px); } 62% { clip-path:inset(0 round 18px); transform:translate3d(0,-1.5%,0) rotateZ(1.8deg) rotateX(0); } to { clip-path:inset(0 round 18px); transform:none; filter:brightness(1) saturate(1) blur(0); } }
@keyframes song-cover-gather { 0% { opacity:0; transform:translate3d(var(--fragment-x),var(--fragment-y),120px) rotateZ(var(--fragment-r)) scale(.68); filter:blur(9px) brightness(1.4); } 18% { opacity:.9; } 72% { opacity:.95; transform:translate3d(0,0,0) rotateZ(0) scale(1); filter:blur(0) brightness(1); } 100% { opacity:0; transform:translate3d(0,0,0) rotateZ(0) scale(1); } }
@keyframes song-cover-float { 0%,100% { transform:translate3d(0,0,0); } 50% { transform:translate3d(0,-6px,0); } }
@keyframes song-cover-record-turn { to { transform:rotate(360deg); } }
@keyframes song-cover-shine { 0%,58% { transform:translateX(0) rotate(24deg); opacity:0; } 72% { opacity:.56; } 92%,100% { transform:translateX(390%) rotate(24deg); opacity:0; } }
@keyframes song-cover-impact { 0%,100% { transform:scale(1); filter:saturate(1); } 34% { transform:scale(1.026); filter:saturate(1.16) brightness(1.08); } 68% { transform:scale(.993); } }
@media (prefers-reduced-motion:reduce) { .song-cover-hero * { animation:none!important; } }
</style>
