<script setup lang="ts">
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import AnnualArtworkFallback from "../AnnualArtworkFallback.vue";
import StorySlideShell from "../StorySlideShell.vue";

defineProps<{ summary: VersionSummaryViewModel; pageIndex: number; pageTotal: number; active: boolean; reducedMotion: boolean }>();
const { n, t } = useI18n();
</script>

<template>
  <StorySlideShell :page-index="pageIndex" :page-total="pageTotal" :eyebrow="summary.copy.milestones.eyebrow" :title="summary.copy.milestones.title" :lead="summary.copy.milestones.body" tone="gold" :active="active" :reduced-motion="reducedMotion" reenter="final">
    <template #background><div class="milestones-bg"><img src="/annual/milestones/background.png" alt="" aria-hidden="true"><i class="milestones-shimmer" /></div></template>
    <div class="milestones-content">
      <div class="milestones-heading"><span>ANNUAL MILESTONES</span><b>{{ summary.milestones.length }}</b></div>
      <div class="moments">
        <article v-for="(item, index) in summary.milestones" :key="`${item.type}-${item.song.songNo}-${item.level}`" class="moment" :style="{ '--delay': `${.3 + index * .22}s` }" data-animate>
          <div class="moment-cover"><el-image :src="item.song.coverUrl" fit="cover"><template #error><AnnualArtworkFallback :label="t('annualSummary.common.defaultCover')" /></template></el-image><i class="cover-sweep" /></div>
          <div class="moment-copy"><span>{{ item.happenedLabel }}</span><strong>{{ item.title }}</strong><h3>{{ item.song.name }}</h3><small>{{ t('annualSummary.slides.milestones.effort', { plays: n(item.playCount), stars: item.song.stars ?? '—' }) }}</small><em v-if="item.achievementCount === 1">{{ t('annualSummary.slides.milestones.onlyOnce') }}</em></div>
        </article>
      </div>
      <p class="milestones-caption">{{ t('annualSummary.copy.milestones.eyebrow') }} · {{ summary.milestones.length }} 个值得记住的节点</p>
    </div>
  </StorySlideShell>
</template>

<style scoped>
.milestones-bg{position:absolute;inset:0;overflow:hidden;background:#61b4ed}.milestones-bg img{width:100%;height:100%;object-fit:cover}.milestones-shimmer{position:absolute;right:17%;top:-10%;width:9%;height:120%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.4),transparent);filter:blur(5px);opacity:0}.milestones-content{position:relative;height:100%;padding:clamp(6px,1vh,14px) clamp(3px,1vw,16px);display:grid;grid-template-rows:auto 1fr auto;gap:clamp(8px,2vh,18px);color:#fff}.milestones-heading{display:flex;align-items:center;gap:10px;color:#fff;text-shadow:0 3px 14px rgba(16,58,112,.45)}.milestones-heading span{font:700 clamp(.7rem,2vw,1rem)/1 var(--viewer-font-family);letter-spacing:.22em}.milestones-heading b{padding:4px 9px;border:1px solid rgba(255,255,255,.55);border-radius:99px;font:700 11px/1 var(--viewer-font-family)}.moments{min-height:0;display:grid;grid-template-rows:repeat(var(--count,3),1fr);gap:clamp(8px,2.2vh,20px);align-content:space-evenly;width:min(70%,500px)}.moment{display:grid;grid-template-columns:clamp(74px,18vw,126px) minmax(0,1fr);align-items:center;gap:clamp(10px,3vw,22px);min-width:0;opacity:0;transform:translate(-10px,5px)}.story-slide-shell.is-active .moment{animation:milestone-in .55s var(--delay) cubic-bezier(.22,.78,.28,1) forwards}.moment-cover{position:relative;width:100%;aspect-ratio:1;border:4px solid rgba(255,255,255,.88);border-radius:18%;overflow:hidden;box-shadow:10px 12px 24px rgba(23,54,93,.35)}.moment-cover :deep(.el-image){width:100%;height:100%}.cover-sweep{position:absolute;inset:-25% auto -25% -80%;width:35%;background:linear-gradient(105deg,transparent,rgba(255,255,255,.8),transparent);transform:rotate(12deg);opacity:0}.story-slide-shell.is-active .moment:nth-child(1) .cover-sweep{animation:cover-sweep .7s .85s ease-out forwards}.story-slide-shell.is-active .moment:nth-child(2) .cover-sweep{animation:cover-sweep .7s 1.07s ease-out forwards}.story-slide-shell.is-active .moment:nth-child(3) .cover-sweep{animation:cover-sweep .7s 1.29s ease-out forwards}.moment-copy{min-width:0;text-shadow:0 2px 10px rgba(16,58,112,.35)}.moment-copy span,.moment-copy small{display:block;color:rgba(255,255,255,.82);font-size:10px}.moment-copy strong{display:block;margin:4px 0;color:#fff;font:700 clamp(1rem,3.4vw,1.7rem)/1.1 var(--viewer-display-font)}.moment-copy h3{margin:0 0 5px;overflow:hidden;color:#fff;font:700 clamp(.85rem,2.6vw,1.2rem)/1.2 var(--viewer-display-font);text-overflow:ellipsis;white-space:nowrap}.moment-copy em{display:inline-block;margin-top:6px;padding:4px 8px;border:1px solid rgba(255,255,255,.45);border-radius:99px;color:#fff;font:700 10px/1 var(--viewer-font-family);font-style:normal}.milestones-caption{margin:0;color:rgba(255,255,255,.75);font-size:10px;letter-spacing:.08em;text-shadow:0 1px 8px rgba(16,58,112,.35)}
.story-slide-shell.is-active .milestones-shimmer{animation:background-shimmer 3.2s .35s ease-out forwards}@keyframes milestone-in{to{opacity:1;transform:translate(0,0)}}@keyframes cover-sweep{0%{left:-80%;opacity:0}20%{opacity:.8}100%{left:150%;opacity:0}}@keyframes background-shimmer{0%{opacity:0;transform:translateX(-180%)}15%{opacity:.45}100%{opacity:0;transform:translateX(650%)}}@media(max-width:720px){.milestones-content{padding-inline:0;gap:10px}.moments{width:76%;gap:10px}.moment{grid-template-columns:clamp(64px,19vw,92px) minmax(0,1fr);gap:10px}.moment-cover{border-width:3px;border-radius:16%}.moment-copy strong{font-size:1rem}.moment-copy h3{font-size:.8rem}.milestones-caption{font-size:10px}}@media(max-height:680px){.moments{gap:6px}.moment-copy strong{font-size:.9rem}.moment-copy h3{margin-bottom:2px}.milestones-caption{display:none}}
</style>
