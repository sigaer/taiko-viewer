<script setup lang="ts">
import { computed } from "vue";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import StorySlideShell from "../StorySlideShell.vue";
import { getHighScoreCopy } from "~/utils/annualCopy";
const props = defineProps<{ summary: VersionSummaryViewModel; pageIndex: number; pageTotal: number; active: boolean; reducedMotion: boolean }>();
const { n, locale, t } = useI18n();
const copy = computed(() => getHighScoreCopy(props.summary.highScore, locale.value === "ja" ? "ja" : "zh"));
</script>
<template>
  <StorySlideShell :page-index="pageIndex" :page-total="pageTotal" eyebrow="HIGH SCORE" :title="copy.title" :lead="copy.body" tone="gold" mood="award-stage" :active="active" :reduced-motion="reducedMotion">
    <template #background><div class="score-bg"><img src="/annual/highScore/background.png" alt=""><span /></div></template>
    <div class="score-slide" :class="{ 'is-empty': !summary.highScore }"><div class="score-slide__record" data-animate><img src="/annual/highScore/record-player.png" alt=""><div class="score-slide__cover"><img v-if="summary.highScore" :src="summary.highScore.song.coverUrl" :alt="summary.highScore.song.name" loading="lazy"><span v-else>★</span></div></div><div class="score-slide__copy"><span>{{ summary.highScore?.happenedLabel || t('annualSummary.common.unavailable') }}</span><strong data-animate>{{ summary.highScore ? n(summary.highScore.score) : '—' }}</strong><small> SCORE</small><h3 data-animate>{{ summary.highScore?.song.name || t('annualSummary.common.songWaiting') }}</h3><p data-animate>{{ copy.body }}</p></div></div>
  </StorySlideShell>
</template>
<style scoped>
.score-bg{position:absolute;inset:0;background:#11132f;overflow:hidden}.score-bg img{width:100%;height:100%;object-fit:cover;opacity:.72}.score-bg span{position:absolute;inset:0;background:radial-gradient(circle at 72% 35%,#f5cb7245,transparent 30%),linear-gradient(180deg,#10122dcc,#0b0d20ee)}.score-slide{height:100%;display:grid;grid-template-columns:minmax(220px,.9fr) minmax(0,1.1fr);gap:clamp(18px,5vw,64px);align-items:center;color:#fff}.score-slide__record{position:relative;justify-self:center;width:min(41vh,370px);aspect-ratio:1;animation:spin 18s linear infinite}.score-slide__record>img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 26px 34px #05061599)}.score-slide__cover{position:absolute;inset:18%;border-radius:50%;overflow:hidden;background:#26264f;display:grid;place-items:center;color:#f5cb72;font-size:3rem}.score-slide__cover img{width:100%;height:100%;object-fit:cover}.score-slide__copy>span{color:#f5cb72;font-size:12px}.score-slide__copy>strong{display:inline-block;margin-top:8px;color:#fff4d5;font:700 clamp(2.8rem,8vw,6.5rem)/.9 var(--viewer-display-font);letter-spacing:-.04em}.score-slide__copy>small{color:#f5cb72;font-size:11px}.score-slide__copy h3{margin:15px 0 10px;color:#fff;font:700 clamp(1.4rem,3vw,2.8rem)/1.08 var(--viewer-display-font);overflow-wrap:anywhere}.score-slide__copy p{max-width:32ch;margin:0;color:#ffefc7c2;font-size:13px;line-height:1.6}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:720px){.score-slide{grid-template-columns:42% 1fr;gap:12px}.score-slide__record{width:min(32vh,170px)}.score-slide__copy>strong{font-size:clamp(2.2rem,11vw,4rem)}.score-slide__copy h3{font-size:1.15rem;margin:8px 0 6px}.score-slide__copy p{font-size:12px;line-height:1.4}}@media(prefers-reduced-motion:reduce){.score-slide__record{animation:none}}
</style>
