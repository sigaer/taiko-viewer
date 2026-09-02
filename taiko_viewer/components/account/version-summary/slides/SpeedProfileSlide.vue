<script setup lang="ts">
import { computed } from "vue";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import StorySlideShell from "../StorySlideShell.vue";
import { getSpeedProfileCopy } from "~/utils/annualCopy";
import { isUsableMetric } from "~/utils/annualPresentation";
const props = defineProps<{ summary: VersionSummaryViewModel; pageIndex: number; pageTotal: number; active: boolean; reducedMotion: boolean }>();
const { locale } = useI18n();
const copy = computed(() => getSpeedProfileCopy(props.summary.speedProfile, locale.value === "ja" ? "ja" : "zh"));
const speed = computed(() => props.summary.speedProfile?.speed || 0);
// Keep the statistic card hidden when the metric is unavailable.
const hasChartCount = computed(() => Boolean(props.summary.speedProfile && isUsableMetric(props.summary.speedProfile.chartCount))); // isUsableMetric(summary.speedProfile.chartCount)
</script>
<template>
  <StorySlideShell :page-index="pageIndex" :page-total="pageTotal" eyebrow="SPEED SIGNATURE" :title="copy.title" :lead="copy.body" tone="royal" mood="speed-night" :active="active" :reduced-motion="reducedMotion">
    <template #background><div class="speed-bg"><img src="/annual/speedProfile/background.png" alt=""><img class="speed-bg__city" src="/annual/speedProfile/city-silhouette.png" alt=""></div></template>
    <div class="speed-slide"><div class="speed-dial" data-animate><div class="speed-dial__ticks"><i v-for="i in 12" :key="i" :style="{ transform: `rotate(${i * 25 - 150}deg)` }" /></div><strong>{{ speed ? speed.toFixed(1) : '—' }}</strong><span>×</span><em>{{ copy.tag }}</em></div><div class="speed-story"><span>年度倍速偏好</span><h3 data-animate>{{ copy.tag }}</h3><p data-animate>{{ copy.body }}</p><div v-if="hasChartCount" class="speed-story__stat"><b>{{ props.summary.speedProfile?.chartCount }}</b><small> 张谱面留下这个速度</small></div></div></div>
  </StorySlideShell>
</template>
<style scoped>
.speed-bg{position:absolute;inset:0;background:#15163b;overflow:hidden}.speed-bg>img:first-child{width:100%;height:100%;object-fit:cover;opacity:.72}.speed-bg__city{position:absolute;bottom:0;width:100%;opacity:.68}.speed-slide{height:100%;display:grid;grid-template-columns:minmax(220px,.9fr) minmax(0,1.1fr);gap:clamp(18px,5vw,64px);align-items:center;color:#fff}.speed-dial{position:relative;justify-self:center;width:min(40vh,350px);aspect-ratio:1;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle,#36366b 0 53%,#191a44 54%);border:2px solid #f5cb72aa;box-shadow:0 0 0 12px #f5cb721c,0 24px 52px #07071c99}.speed-dial__ticks{position:absolute;inset:10%;border-radius:50%}.speed-dial__ticks i{position:absolute;left:50%;top:0;width:2px;height:12px;background:#f5cb72;transform-origin:50% 175px}.speed-dial strong{margin-top:-12px;color:#fff4d5;font:700 clamp(4rem,13vw,8rem)/.8 var(--viewer-display-font)}.speed-dial>span{margin-top:-28px;color:#f5cb72;font-size:2rem}.speed-dial em{position:absolute;bottom:18%;color:#f5cb72;font-size:12px;font-style:normal;letter-spacing:.1em}.speed-story>span{color:#f5cb72;font-size:12px;letter-spacing:.14em}.speed-story h3{margin:12px 0 9px;color:#fff;font:700 clamp(1.5rem,4vw,3rem)/1.08 var(--viewer-display-font)}.speed-story p{max-width:32ch;margin:0;color:#ffefc7c2;font-size:13px;line-height:1.6}.speed-story__stat{margin-top:22px;color:#f5cb72}.speed-story__stat b{font-size:2rem;color:#fff4d5}.speed-story__stat small{margin-left:8px;font-size:12px}@media(max-width:720px){.speed-slide{grid-template-columns:44% 1fr;gap:12px}.speed-dial{width:min(31vh,175px);box-shadow:0 0 0 7px #f5cb721c,0 16px 30px #07071c99}.speed-dial__ticks i{transform-origin:50% 88px!important;height:7px}.speed-dial strong{font-size:clamp(3rem,14vw,5rem)}.speed-dial>span{font-size:1.3rem}.speed-story h3{font-size:1.2rem;margin:8px 0}.speed-story p{font-size:12px;line-height:1.4}.speed-story__stat{margin-top:12px}}@media(prefers-reduced-motion:reduce){.speed-dial{animation:none}}
</style>
