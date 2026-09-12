<script setup lang="ts">
import { computed } from 'vue';
import type { VersionSummaryViewModel } from '~/types/account-version-summary';
import StorySlideShell from '../StorySlideShell.vue';
import AnnualVinylRecord from '../AnnualVinylRecord.vue';
import AnimatedNumber from '../AnimatedNumber.vue';
import { getHighScoreCopy } from '~/utils/annualCopy';
const props=defineProps<{summary:VersionSummaryViewModel;pageIndex:number;pageTotal:number;active:boolean;reducedMotion:boolean}>();
const {locale,t}=useI18n(); const item=computed(()=>props.summary.highScore);
const copy=computed(()=>getHighScoreCopy(item.value,locale.value==='ja'?'ja':'zh'));
</script>
<template><StorySlideShell variant="poster" :page-index="pageIndex" :page-total="pageTotal" eyebrow="" :show-meta="false" :title="item?.song.name || copy.title" tone="gold" mood="award-stage" :active="active" :reduced-motion="reducedMotion">
 <template #background><div class="score-poster__bg"><img src="/annual/highScore/background.png" alt=""><i /><i /></div></template>
 <div class="score-poster" :class="{'is-empty':!item}"><p class="score-poster__line" data-animate>{{ item ? copy.title : '今年还没有最高分记录' }}</p><div class="score-poster__record"><AnnualVinylRecord record-src="/annual/highScore/record-player.png" :cover-url="item?.song.coverUrl" :cover-alt="item?.song.name" :active="active" :reduced-motion="reducedMotion" /></div><div class="score-poster__score" data-animate><AnimatedNumber v-if="item" :value="item.score" :active="active" :reduced-motion="reducedMotion" :duration="1400" :delay="250" /><span v-else>—</span><small>SCORE</small></div><p class="score-poster__date">{{ item?.happenedLabel || t('annualSummary.common.unavailable') }}</p><p class="score-poster__copy">{{ item ? copy.body : '下一次游玩，也许就是年度高分的起点。' }}</p></div>
</StorySlideShell></template>
<style scoped>
.score-poster__bg{position:absolute;inset:0;background:#07080c;overflow:hidden}.score-poster__bg img{width:100%;height:100%;object-fit:cover;opacity:.55;filter:saturate(.75) contrast(1.2)}.score-poster__bg i{position:absolute;width:60vw;aspect-ratio:1;border-radius:50%;background:#ed3f202b;filter:blur(45px)}.score-poster__bg i:nth-of-type(1){top:15%;left:-15%}.score-poster__bg i:nth-of-type(2){right:-18%;bottom:4%;background:#f4bb3930}.score-poster{height:100%;display:flex;flex-direction:column;align-items:center;text-align:center;color:#fff}.score-poster__line{margin:.9rem 0 .25rem;color:#ff684f;font-weight:700;font-size:clamp(.9rem,3.6vw,1.2rem);letter-spacing:.04em}.score-poster__record{position:relative;z-index:1}.score-poster__record:before{content:"";position:absolute;inset:7%;border-radius:50%;box-shadow:0 0 65px #ff3c1f90,0 0 25px #ffb12170}.score-poster__record :deep(.vinyl){width:95vw;max-height:47vh}.score-poster__score{display:flex;align-items:baseline;justify-content:center;gap:.45rem;margin-top:5vh;color:#ffe05c;font:900 clamp(3.25rem,15vw,7rem)/.85 var(--viewer-display-font);letter-spacing:-.055em;text-shadow:0 0 18px #e9433f55}.score-poster__score small{font:700 10px/1 var(--viewer-font-family);letter-spacing:.16em;color:#ff7b4e}.score-poster__date{margin:.6rem 0 0;color:#ff7256;font-size:12px;font-weight:700}.score-poster__copy{max-width:31ch;margin:.4rem auto 0;color:#ffecc0c7;font-size:12px;line-height:1.35}.is-empty .score-poster__record{opacity:.68}@media(max-height:760px){.score-poster__score{font-size:clamp(2.8rem,13vw,5rem)}}
</style>
