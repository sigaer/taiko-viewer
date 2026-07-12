<script setup lang="ts">
import { computed } from "vue";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import StorySlideShell from "../StorySlideShell.vue";

const props = defineProps<{ summary: VersionSummaryViewModel; pageIndex: number; pageTotal: number; active: boolean; reducedMotion: boolean }>();
const { t, locale } = useI18n();
const max = computed(() => Math.max(...(props.summary.weekdayActivity?.counts || [1]), 1));
const formatter = computed(() => new Intl.NumberFormat(locale.value === "ja" ? "ja-JP" : "zh-CN"));
</script>

<template>
  <StorySlideShell :page-index="pageIndex" :page-total="pageTotal" :eyebrow="summary.copy.weekdayActivity.eyebrow" :title="summary.copy.weekdayActivity.title" :lead="summary.copy.weekdayActivity.body" tone="aurora" :active="active" :reduced-motion="reducedMotion">
    <div v-if="summary.weekdayActivity" class="week">
      <div class="bars" data-animate>
        <div v-for="(count, index) in summary.weekdayActivity.counts" :key="index" :class="{ top: index === summary.weekdayActivity.topWeekday, bottom: index === summary.weekdayActivity.bottomWeekday }">
          <span><i :style="{ height: `${Math.max(8, count / max * 100)}%` }"></i></span>
          <strong>{{ summary.weekdayActivity.labels[index] }}</strong><small>{{ formatter.format(count) }}</small>
        </div>
      </div>
      <div class="facts">
        <article data-animate><span>{{ t("annualSummary.slides.weekday.top") }}</span><strong>{{ summary.weekdayActivity.topLabel }}</strong></article>
        <article data-animate><span>{{ t("annualSummary.slides.weekday.bottom") }}</span><strong>{{ summary.weekdayActivity.bottomLabel }}</strong></article>
      </div>
    </div>
  </StorySlideShell>
</template>

<style scoped>
.week{height:100%;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(190px,25%);gap:12px}.bars,.facts article{padding:16px;border:1px solid rgba(57,120,200,.18);border-radius:24px;background:rgba(247,251,255,.84);box-shadow:0 14px 34px rgba(23,54,93,.08)}.bars{min-height:0;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:9px;align-items:end}.bars>div{height:100%;min-width:0;display:grid;grid-template-rows:minmax(0,1fr) auto auto;gap:5px;text-align:center}.bars>div>span{display:flex;align-items:end;justify-content:center}.bars i{display:block;width:min(42px,72%);border-radius:99px 99px 12px 12px;background:linear-gradient(#9bc9ff,#3978c8)}.bars .top i{background:linear-gradient(#9bc9ff,#3978c8);box-shadow:0 0 24px rgba(57,120,200,.45)}.bars strong{color:#17365d;font-size:12px}.bars small{color:#3978c8;font-size:10px}.facts{display:grid;gap:10px}.facts article{display:grid;align-content:center}.facts span{color:#5c7697;font-size:12px}.facts strong{margin-top:8px;color:#17365d;font:700 clamp(1.5rem,3vw,2.2rem)/1 var(--viewer-display-font)}
@media(max-width:720px){.week{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) auto;gap:6px}.bars{padding:9px 7px;gap:4px;border-radius:17px}.bars strong{font-size:10px}.bars small{font-size:10px}.facts{grid-template-columns:1fr 1fr;gap:6px}.facts article{padding:8px 10px;border-radius:15px}.facts span{font-size:10px}.facts strong{margin-top:3px;font-size:1rem}}
</style>
