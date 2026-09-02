<script setup lang="ts">
import { computed } from "vue";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import StorySlideShell from "../StorySlideShell.vue";
import { getPoundSpeedCopy } from "~/utils/annualCopy";
const props = defineProps<{ summary: VersionSummaryViewModel; pageIndex: number; pageTotal: number; active: boolean; reducedMotion: boolean }>();
const { t, locale } = useI18n();
const copy = computed(() => getPoundSpeedCopy(props.summary.pound, locale.value === "ja" ? "ja" : "zh"));
const speed = computed(() => props.summary.pound?.speed || 0);
</script>
<template>
  <StorySlideShell :page-index="pageIndex" :page-total="pageTotal" eyebrow="SPEED BURST" :title="copy.title" :lead="copy.body" tone="royal" mood="speed-night" :active="active" :reduced-motion="reducedMotion">
    <template #background><div class="pound-bg"><img src="/annual/pound/background.webp" alt=""><img class="pound-bg__city" src="/annual/pound/city-silhouette.png" alt=""></div></template>
    <div class="pound-slide" :class="{ 'is-empty': !speed }">
      <div class="pound-slide__record" data-animate><img src="/annual/pound/record-player.png" alt=""><div class="pound-slide__cover"><img v-if="summary.pound?.topSong" :src="summary.pound.topSong.coverUrl" :alt="summary.pound.topSong.name" loading="lazy"><span v-else>♪</span></div></div>
      <div class="pound-slide__copy"><span class="pound-slide__label">最高秒速</span><strong data-animate>{{ speed ? speed.toFixed(1) : '—' }}</strong><small v-if="speed">打 / 秒</small><h3 data-animate>{{ summary.pound?.topSong?.name || t('annualSummary.common.songWaiting') }}</h3><p data-animate>{{ speed ? copy.body : copy.body }}</p></div>
    </div>
  </StorySlideShell>
</template>
<style scoped>
.pound-bg{position:absolute;inset:0;background:#17163d;overflow:hidden}.pound-bg>img:first-child{width:100%;height:100%;object-fit:cover;opacity:.84}.pound-bg__city{position:absolute;left:0;right:0;bottom:0;width:100%}.pound-slide{height:100%;display:grid;grid-template-columns:minmax(220px,.9fr) minmax(0,1.1fr);gap:clamp(18px,5vw,64px);align-items:center;color:#fff}.pound-slide__record{position:relative;justify-self:center;width:min(38vh,350px);aspect-ratio:1;filter:drop-shadow(0 28px 38px #08081f99);animation:float 6s ease-in-out infinite}.pound-slide__record>img{width:100%;height:100%;object-fit:contain}.pound-slide__cover{position:absolute;inset:18%;border-radius:50%;overflow:hidden;background:#252557;display:grid;place-items:center;color:#f5cb72;font-size:3rem}.pound-slide__cover img{width:100%;height:100%;object-fit:cover}.pound-slide__label{display:block;color:#f5cb72;font-size:12px;letter-spacing:.16em}.pound-slide__copy>strong{font:700 clamp(4rem,14vw,9rem)/.86 var(--viewer-display-font);color:#fff4d5}.pound-slide__copy>small{margin-left:8px;color:#f5cb72}.pound-slide__copy h3{margin:14px 0 9px;color:#fff;font:700 clamp(1.35rem,3vw,2.8rem)/1.08 var(--viewer-display-font);overflow-wrap:anywhere}.pound-slide__copy p{max-width:32ch;margin:0;color:#ffefc7c2;font-size:13px;line-height:1.6}.is-empty .pound-slide__record{opacity:.6}@keyframes float{50%{transform:translateY(-8px)}}@media(max-width:720px){.pound-slide{grid-template-columns:42% 1fr;gap:12px}.pound-slide__record{width:min(32vh,170px)}.pound-slide__copy>strong{font-size:clamp(3.2rem,16vw,5.5rem)}.pound-slide__copy h3{font-size:1.15rem;margin:9px 0 6px}.pound-slide__copy p{font-size:12px;line-height:1.4}}@media(prefers-reduced-motion:reduce){.pound-slide__record{animation:none}}
</style>
