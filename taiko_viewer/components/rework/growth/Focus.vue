<script setup lang="ts">
// "关注方向" of the growth page: the focus runs of the selected period (passport focusTimeline) as a band, the
// current run marked, the change note and the existing explanation behind "了解更多". Labels and days come from the page.
import type { SkillPassportFocusRun } from "~/types/player-growth";

defineProps<{
  runs: SkillPassportFocusRun[];
  label: (focus: SkillPassportFocusRun["focus"]) => string;
  day: (value: string) => string;
  note: string;
}>();
const { t } = useI18n();
</script>

<template>
  <ReworkPanel class="gf passport-focus-history" plain :title="t('passport.focusTitle')">
    <p v-if="note" class="gf-note passport-focus-note">{{ note }}</p>
    <ol class="gf-band">
      <li v-for="run in runs" :key="run.id" class="gf-run" :class="{ 'is-current': run.current }" :aria-current="run.current ? 'step' : undefined">
        <b>{{ label(run.focus) }}</b>
        <small class="num">{{ day(run.startedAt) }}<template v-if="run.endedAt !== run.startedAt"> — {{ day(run.endedAt) }}</template></small>
      </li>
    </ol>
    <details class="gf-more passport-fact-details">
      <summary>{{ t("passport.learnMore") }}</summary>
      <p>{{ t("passport.focusMeaning") }}</p>
    </details>
  </ReworkPanel>
</template>

<style scoped>
.gf-note {
  margin: 0 0 var(--sp-3);
  font-size: var(--fs-14);
  line-height: var(--lh-body);
}
.gf-band {
  display: flex;
  gap: 4px;
  margin: 0;
  padding: 0 0 var(--sp-2);
  overflow-x: auto;
  list-style: none;
  overscroll-behavior-inline: contain;
}
.gf-run {
  display: grid;
  gap: 2px;
  flex: 1 0 auto;
  min-width: 112px;
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--r-ctl);
  background: var(--series-band-bg);
  border-top: 3px solid var(--series-band-line);
}
.gf-run.is-current {
  border-top-color: var(--series-band-cur);
}
.gf-run b {
  font-size: var(--fs-14);
}
.gf-run small {
  color: var(--ink-3);
  font-size: var(--fs-12);
}
.gf-more {
  color: var(--ink-2);
  font-size: var(--fs-13);
}
.gf-more summary {
  display: flex;
  align-items: center;
  min-height: var(--hit);
  color: var(--link);
  cursor: pointer;
}
.gf-more summary:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.gf-more p {
  margin: 0;
  line-height: var(--lh-body);
}
</style>
