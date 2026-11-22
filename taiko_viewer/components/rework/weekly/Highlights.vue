<script setup lang="ts">
// Keep the theme's headline and show the other measured changes on the same chart.
import type { WeeklyGrowthHighlight } from "~/types/player-growth";
import { factCrown, rankValue } from "~/utils/rework/today";
import type { DsCrownState } from "~/utils/ds/crown";
import { computed, ref, watch } from "vue";

const props = defineProps<{ items: WeeklyGrowthHighlight[]; change: (highlight: WeeklyGrowthHighlight) => string }>();
const { t, locale } = useI18n();
const localePath = useLocalePath();
const expanded = ref(false);
watch(() => props.items, () => { expanded.value = false; });
const visible = computed(() => expanded.value ? props.items : props.items.slice(0, 4));
const crownBefore = (value: number | null): DsCrownState => value === 2 ? 'dondaful' : value === 1 ? 'full' : value === 0 ? 'clear' : value === -1 ? 'played' : 'none';
const to = (h: WeeklyGrowthHighlight) => localePath({ path: `/songs/${h.songId}`, query: { difficulty: String(h.difficultyType) } });
const supportingFacts = (h: WeeklyGrowthHighlight) => (h.facts || []).filter(fact =>
  fact.factKey !== h.primaryFactKey && ['clear', 'fc', 'df', 'rank-upgrade', 'score-pb', 'ng-reduced', 'combo-improved'].includes(fact.type)
);
const value = (n: number | null) => n === null ? '—' : n.toLocaleString(locale.value === 'ja' ? 'ja-JP' : 'zh-CN');
</script>

<template>
  <div class="wl-section">
  <ol class="wl">
    <li v-for="highlight in visible" :key="highlight.id" class="wl-item weekly-highlight">
      <NuxtLink :to="to(highlight)" class="wl-cover weekly-highlight__cover" tabindex="-1" aria-hidden="true">
        <DsCover :song-id="highlight.songId" size="md" />
      </NuxtLink>
      <div class="wl-body weekly-highlight__body">
        <p class="wl-change weekly-highlight__change">
          <DsRank v-if="highlight.primaryType === 'rank-upgrade' && rankValue(highlight.after) !== null"
            :value="rankValue(highlight.after)" :previous="rankValue(highlight.before)"
            :variant="rankValue(highlight.before) !== null ? 'upgrade' : 'default'" />
          <span v-else-if="factCrown(highlight.primaryType)" class="wl-crown-change" role="img" :aria-label="t(`weekly.fact.${highlight.primaryType}`)" :title="t(`weekly.fact.${highlight.primaryType}`)">
            <template v-if="highlight.before !== null">
              <DsCrown :state="crownBefore(highlight.before)" size="md" aria-hidden="true" />
              <span class="wl-arrow" aria-hidden="true">→</span>
            </template>
            <DsCrown :state="factCrown(highlight.primaryType)!" size="lg" aria-hidden="true" />
          </span>
          <template v-else>{{ change(highlight) }}</template>
        </p>
        <NuxtLink :to="to(highlight)" class="rw-link wl-name">{{ highlight.title }}</NuxtLink>
        <span class="wl-meta">
          <DsDiff :difficulty="highlight.difficultyType" :show-constant="false" />
        </span>
        <ul v-if="supportingFacts(highlight).length" class="wl-facts">
          <li v-for="fact in supportingFacts(highlight)" :key="fact.factKey">
            <DsRank v-if="fact.type === 'rank-upgrade' && rankValue(fact.after) !== null"
              :value="rankValue(fact.after)" :previous="rankValue(fact.before)"
              :variant="rankValue(fact.before) !== null ? 'upgrade' : 'default'" />
            <span v-else-if="factCrown(fact.type)" class="wl-crown-change" role="img" :aria-label="t(`weekly.fact.${fact.type}`)" :title="t(`weekly.fact.${fact.type}`)">
              <template v-if="fact.before !== null">
                <DsCrown :state="crownBefore(fact.before)" size="sm" aria-hidden="true" />
                <span class="wl-arrow" aria-hidden="true">→</span>
              </template>
              <DsCrown :state="factCrown(fact.type)!" size="md" aria-hidden="true" />
            </span>
            <template v-else>{{ t(`weekly.fact.${fact.type}`) }} <span v-if="fact.before !== null">{{ value(fact.before) }} → </span><strong>{{ value(fact.after) }}</strong></template>
          </li>
        </ul>
        <small v-if="highlight.goalCompleted" class="wl-goal">{{ t("weekly.goalCompleted") }}</small>
      </div>
    </li>
  </ol>
  <button v-if="items.length > 4" class="rw-btn rw-btn--ghost wl-more" type="button" :aria-expanded="expanded" @click="expanded = !expanded">
    {{ expanded ? t('weekly.showLess') : t('weekly.showAll', { count: items.length }) }}
  </button>
  </div>
</template>

<style scoped>
.wl-section { min-width: 0; }
.wl {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--line-strong);
}
.wl-item {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: var(--sp-4);
  align-items: start;
  padding: var(--sp-4) 0;
  border-bottom: 1px solid var(--line);
}
.wl-cover {
  display: block;
  line-height: 0;
}
.wl-body {
  display: grid;
  justify-items: start;
  gap: 4px;
  min-width: 0;
}
.wl-change {
  margin: 0;
  font-size: var(--fs-16);
  font-weight: 700;
  line-height: var(--lh-snug);
  overflow-wrap: anywhere;
}
.wl-name {
  font-size: var(--fs-14);
  font-weight: 600;
  overflow-wrap: anywhere;
}
.wl-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--sp-1) var(--sp-3);
  color: var(--ink-2);
  font-size: var(--fs-13);
}
.wl-facts {
  display: grid;
  gap: var(--sp-1);
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--ink-2);
  font-size: var(--fs-14);
  font-variant-numeric: tabular-nums;
}
.wl-facts strong {
  color: var(--ink);
}
.wl-goal {
  color: var(--ink-2);
  font-size: var(--fs-13);
  font-weight: 600;
}
.wl-crown-change { display: inline-flex; align-items: center; gap: var(--sp-2); }
.wl-arrow { color: var(--ink-3); font-weight: 400; }
.wl-more { margin-top: var(--sp-3); justify-self: start; }
@media (max-width: 767px) {
  .wl-item {
    gap: var(--sp-3);
  }
}
</style>
