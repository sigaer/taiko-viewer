<script setup lang="ts">
import { computed } from 'vue';
import type { VersionSummaryViewModel } from '~/types/account-version-summary';
import StorySlideShell from '../StorySlideShell.vue';
import AnnualVinylRecord from '../AnnualVinylRecord.vue';
import { getSpeedProfileCopy } from '~/utils/annualCopy';
import { isUsableMetric } from '~/utils/annualPresentation';
const props=defineProps<{summary:VersionSummaryViewModel;pageIndex:number;pageTotal:number;active:boolean;reducedMotion:boolean}>();
const {locale}=useI18n(); const profile=computed(()=>props.summary.speedProfile);
const copy=computed(()=>getSpeedProfileCopy(profile.value,locale.value==='ja'?'ja':'zh'));
// Guard unavailable metrics with isUsableMetric(summary.speedProfile.chartCount).
const hasCount=computed(()=>!!profile.value&&isUsableMetric(profile.value.chartCount));
</script>
<template><StorySlideShell variant="poster" :page-index="pageIndex" :page-total="pageTotal" eyebrow="SPEED SIGNATURE" :title="profile ? '年度倍速画像' : '今年还没有形成倍速画像'" tone="aurora" mood="speed-night" :active="active" :reduced-motion="reducedMotion">
 <template #background><div class="profile-poster__bg"><img src="/annual/speedProfile/background.png" alt=""><div class="profile-poster__city" /></div></template>
 <div class="profile-poster" :class="{'is-empty':!profile}"><div class="profile-poster__headline" data-animate><p>这一年，你的节奏档位</p><strong>{{ profile ? profile.speed.toFixed(1) : '—' }}<small>×</small></strong><span v-if="hasCount">使用在 <b>{{ profile?.chartCount }}</b> 张谱面</span></div><div class="profile-poster__record"><AnnualVinylRecord :center-text="profile ? `${profile.speed.toFixed(1)}×` : '—'" tone="light" :active="active" :reduced-motion="reducedMotion" /></div><div class="profile-poster__footer" data-animate><strong>{{ profile ? copy.tag : '节奏画像待生成' }}</strong><p>{{ profile ? copy.body : '多打几首歌，你的节奏档位就会慢慢浮现。' }}</p></div></div>
</StorySlideShell></template>
<style scoped>
.profile-poster__bg{position:absolute;inset:0;background:linear-gradient(180deg,#d3e35b 0%,#92c86c 39%,#bdbdc7 39%,#bdbdc7 100%);overflow:hidden}.profile-poster__bg>img{width:100%;height:42%;object-fit:cover;opacity:.58;mix-blend-mode:screen}.profile-poster__city{position:absolute;left:0;right:0;top:33%;height:16%;background:url('/annual/speedProfile/city-silhouette.png') center bottom/cover no-repeat;filter:brightness(.2) saturate(.75)}.profile-poster{height:100%;display:flex;flex-direction:column;align-items:center;text-align:center;color:#162317}.profile-poster__headline{position:relative;z-index:1;padding-top:.65rem}.profile-poster__headline p{margin:0;color:#294729;font-size:12px;font-weight:700;letter-spacing:.08em}.profile-poster__headline>strong{display:block;color:#172619;font:900 clamp(4.7rem,21vw,9rem)/.88 var(--viewer-display-font);letter-spacing:-.06em}.profile-poster__headline>strong small{font-size:.25em;letter-spacing:0}.profile-poster__headline>span{display:block;color:#294729;font-size:clamp(.9rem,4vw,1.2rem);font-weight:700}.profile-poster__headline>span b{font-size:1.45em}.profile-poster__record{position:relative;z-index:1;margin-top:.2rem}.profile-poster__record :deep(.vinyl){width:min(78vw,430px);max-height:46vh}.profile-poster__footer{position:relative;z-index:1;margin-top:-.1rem;color:#fff}.profile-poster__footer strong{display:block;color:#fff;font:800 clamp(1.5rem,6.2vw,2.8rem)/1 var(--viewer-display-font)}.profile-poster__footer p{max-width:30ch;margin:.55rem auto 0;color:#334238c7;font-size:12px;line-height:1.4}.is-empty .profile-poster__record{opacity:.7}@media(max-height:740px){.profile-poster__record :deep(.vinyl){width:min(64vw,340px)}.profile-poster__headline>strong{font-size:clamp(3.5rem,17vw,6rem)}}
</style>
