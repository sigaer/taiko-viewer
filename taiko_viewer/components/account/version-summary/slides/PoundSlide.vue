<script setup lang="ts">
import { computed } from 'vue';
import type { VersionSummaryViewModel } from '~/types/account-version-summary';
import StorySlideShell from '../StorySlideShell.vue';
import AnnualVinylRecord from '../AnnualVinylRecord.vue';
import { getPoundSpeedCopy } from '~/utils/annualCopy';
const props=defineProps<{summary:VersionSummaryViewModel;pageIndex:number;pageTotal:number;active:boolean;reducedMotion:boolean}>();
const {locale,t}=useI18n();
const copy=computed(()=>getPoundSpeedCopy(props.summary.pound,locale.value==='ja'?'ja':'zh'));
const speed=computed(()=>props.summary.pound?.speed);
const song=computed(()=>props.summary.pound?.topSong);
</script>
<template><StorySlideShell variant="poster" :page-index="pageIndex" :page-total="pageTotal" eyebrow="SPEED BURST" :title="speed ? '最高秒速歌曲' : '最高秒速记录'" tone="royal" mood="speed-night" :active="active" :reduced-motion="reducedMotion">
  <template #background><div class="pound-poster__bg"><img src="/annual/pound/background.webp" alt=""><div class="pound-poster__city" /></div></template>
  <div class="pound-poster" :class="{'is-empty':!speed}"><div class="pound-poster__hero"><p class="pound-poster__kicker">{{ speed ? copy.title : '今年还没有记录到最高秒速' }}</p><div class="pound-poster__speed" data-animate><strong>{{ speed ? speed.toFixed(1) : '—' }}</strong><span>打 / 秒</span></div><p class="pound-poster__sub">{{ speed ? copy.body : '等下一段连打，把鼓点推到更快的位置。' }}</p></div><div class="pound-poster__record"><AnnualVinylRecord :cover-url="song?.coverUrl" :cover-alt="song?.name" :active="active" :reduced-motion="reducedMotion" /><div class="pound-poster__caption">{{ song?.name || t('annualSummary.common.songWaiting') }}<small v-if="speed">按连打区间换算</small></div></div></div>
</StorySlideShell></template>
<style scoped>
.pound-poster__bg{position:absolute;inset:0;background:linear-gradient(180deg,#ec8caf 0%,#c45a9a 35%,#1d1b3b 70%);overflow:hidden}.pound-poster__bg>img{width:100%;height:65%;object-fit:cover;opacity:.48;mix-blend-mode:screen}.pound-poster__city{position:absolute;left:0;right:0;bottom:21%;height:25%;background:url('/annual/pound/city-silhouette.png') center bottom/cover no-repeat;filter:brightness(.2) saturate(.7)}.pound-poster{height:100%;display:flex;flex-direction:column;align-items:center;color:#fff}.pound-poster__hero{text-align:center;z-index:1;padding-top:clamp(1rem,3vh,2rem)}.pound-poster__kicker{margin:0;color:#fff;font:700 clamp(1.3rem,5.8vw,3rem)/1.05 var(--viewer-display-font);text-wrap:balance}.pound-poster__speed{display:flex;align-items:baseline;justify-content:center;gap:8px;margin-top:.35rem}.pound-poster__speed strong{font:800 clamp(4.8rem,22vw,10rem)/.82 var(--viewer-display-font);letter-spacing:-.06em;color:#fff}.pound-poster__speed span{font-weight:700;font-size:clamp(.8rem,3vw,1.25rem);white-space:nowrap}.pound-poster__sub{max-width:30ch;margin:.65rem auto 0;color:#ffe8f3cc;font-size:12px;line-height:1.4}.pound-poster__record{position:relative;z-index:1;margin-top:clamp(-1rem,1vh,1rem);display:flex;flex-direction:column;align-items:center;flex:1;min-height:0}.pound-poster__record :deep(.vinyl){width:min(78vw,430px);max-height:52vh}.pound-poster__caption{margin-top:-.4rem;text-align:center;font:700 clamp(1rem,4vw,1.5rem)/1.1 var(--viewer-display-font);max-width:90vw;overflow-wrap:anywhere}.pound-poster__caption small{display:block;margin-top:.4rem;color:#ffe8f3b8;font:400 11px/1.2 var(--viewer-font-family)}.is-empty .pound-poster__speed strong{color:#ffffffb8}@media(max-height:720px){.pound-poster__record :deep(.vinyl){width:min(62vw,330px)}}
</style>
