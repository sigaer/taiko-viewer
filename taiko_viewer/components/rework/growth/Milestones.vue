<script setup lang="ts">
// "精彩时刻" of the growth page: the curated milestones of /api/account/growth/passport, newest first, as a dated
// spine. The narrative lines, dates and the expand state come from pages/my/growth.vue (unchanged); this draws them.
// A crown milestone shows the crown with its name, a rank milestone the ranks with their names.
import type { SkillPassportMilestone } from "~/types/player-growth";
import type { composePassportMilestoneNarrative } from "~/utils/passportNarrative";
import { difficultyLabelKey } from "~/utils/difficulty";
import { factCrown, rankValue } from "~/utils/rework/today";

type Narrative = ReturnType<typeof composePassportMilestoneNarrative>;
defineProps<{
  items: SkillPassportMilestone[];
  total: number;
  narrative: (node: SkillPassportMilestone) => Narrative;
  evidenceText: (line: Narrative["support"][number]) => string;
  dateText: (node: SkillPassportMilestone) => string;
  factDates: string;
  more: boolean;
  expanded: boolean;
  coverageNote: string;
}>();
const emit = defineEmits<{ toggle: [] }>();
const { t } = useI18n();
const localePath = useLocalePath();
</script>

<template>
  <ReworkPanel class="gm passport-milestones" plain :title="t('passport.milestonesTitle')">
    <p class="rw-count gm-range">{{ factDates }}</p>
    <ol v-if="total" id="passport-milestone-list" class="gm-spine passport-milestone-list">
      <li v-for="milestone in items" :key="milestone.id" class="gm-item passport-milestone">
        <span class="gm-date">
          <time class="num">{{ dateText(milestone) }}</time>
          <small v-if="milestone.observationOnly">{{ t("passport.observedDay") }}</small>
        </span>
        <span class="gm-dot" aria-hidden="true" />
        <span class="gm-body">
          <span class="gm-headline passport-milestone-headline">{{ t(narrative(milestone).headline.key, narrative(milestone).headline.params) }}</span>
          <span class="gm-song">
            <NuxtLink v-if="milestone.songId" class="rw-link gm-name" :to="localePath({ path: `/songs/${milestone.songId}`, query: milestone.difficultyType ? { difficulty: String(milestone.difficultyType) } : undefined })">{{ milestone.title }}</NuxtLink>
            <b v-else class="gm-name">{{ milestone.title }}</b>
            <span v-if="milestone.difficultyType" class="gm-diff">{{ t(difficultyLabelKey(milestone.difficultyType)) }}</span>
          </span>
          <DsCrown v-if="factCrown(milestone.primaryType)" :state="factCrown(milestone.primaryType)!" size="sm" text="full" />
          <span v-else-if="milestone.primaryType === 'rank-upgrade' && rankValue(milestone.after) !== null" class="gm-rank">
            <template v-if="rankValue(milestone.before) !== null"><DsRank :value="rankValue(milestone.before)" named /><span aria-hidden="true">→</span></template>
            <DsRank :value="rankValue(milestone.after)" named />
          </span>
          <span v-if="narrative(milestone).support.length" class="gm-evidence passport-milestone-evidence">{{ narrative(milestone).support.map(evidenceText).join(" · ") }}</span>
          <details v-if="narrative(milestone).detail.length" class="gm-details passport-fact-details">
            <summary>{{ t("passport.moreEvidence") }}</summary>
            <p v-for="(line, index) in narrative(milestone).detail" :key="index">{{ evidenceText(line) }}</p>
          </details>
          <small v-if="milestone.goalCompleted && !milestone.observationOnly && milestone.primaryType !== 'goal-completed'" class="gm-goal">{{ t("passport.goalCompleted") }}</small>
        </span>
      </li>
    </ol>
    <ReworkState v-else kind="empty" compact class="passport-empty" :title="t('passport.noMilestones')" />
    <button v-if="more" type="button" class="rw-btn rw-btn--ghost gm-more passport-more" :aria-expanded="expanded" aria-controls="passport-milestone-list" @click="emit('toggle')">
      {{ t(expanded ? "passport.fewerMilestones" : "passport.moreMilestones") }}
    </button>
    <p v-if="coverageNote" class="rw-count gm-range">{{ coverageNote }}</p>
  </ReworkPanel>
</template>

<style scoped>
.gm-range {
  margin: 0 0 var(--sp-3);
}
.gm-spine {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}
.gm-item {
  position: relative;
  display: grid;
  grid-template-columns: 96px 24px minmax(0, 1fr);
  gap: var(--sp-2);
  padding: var(--sp-3) 0;
}
.gm-item::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: calc(96px + var(--sp-2) + 11px);
  border-left: 2px solid var(--line);
}
.gm-item:first-child::before {
  top: var(--sp-5);
}
.gm-item:last-child::before {
  bottom: calc(100% - var(--sp-5));
}
.gm-date {
  display: grid;
  align-content: start;
  gap: 2px;
  padding-top: 2px;
  color: var(--ink-2);
  font-size: var(--fs-13);
}
.gm-date small {
  color: var(--ink-3);
  font-size: var(--fs-11);
}
.gm-dot {
  position: relative;
  z-index: 1;
  justify-self: center;
  width: 12px;
  height: 12px;
  margin-top: 5px;
  border: 2px solid var(--surface);
  border-radius: 50%;
  background: var(--series);
}
.gm-body {
  display: grid;
  justify-items: start;
  gap: 4px;
  min-width: 0;
}
.gm-headline {
  font-size: var(--fs-16);
  font-weight: 700;
  line-height: var(--lh-snug);
}
.gm-song {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 2px var(--sp-2);
  min-width: 0;
}
.gm-name {
  font-size: var(--fs-14);
  font-weight: 600;
  overflow-wrap: anywhere;
}
.gm-diff,
.gm-evidence,
.gm-goal {
  color: var(--ink-2);
  font-size: var(--fs-13);
  line-height: var(--lh-body);
}
.gm-rank {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
}
.gm-details {
  color: var(--ink-2);
  font-size: var(--fs-13);
}
.gm-details summary {
  display: flex;
  align-items: center;
  min-height: var(--hit);
  color: var(--link);
  cursor: pointer;
}
.gm-details summary:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.gm-details p {
  margin: 0 0 var(--sp-1);
}
.gm-more {
  justify-self: start;
  margin-top: var(--sp-2);
}
@media (max-width: 767px) {
  .gm-item {
    grid-template-columns: 24px minmax(0, 1fr);
  }
  .gm-item::before {
    left: 11px;
  }
  .gm-date {
    grid-column: 2;
    grid-row: 1;
  }
  .gm-dot {
    grid-column: 1;
    grid-row: 1 / span 2;
  }
  .gm-body {
    grid-column: 2;
  }
}
</style>
