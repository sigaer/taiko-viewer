<script setup lang="ts">
// Today's progress on the signed-in home. Logic unchanged (what counts as a change, the relocated-to-goal notice,
// attendance states); the markup is styled by components/rework/today/Board.vue. Crown facts show the crown with its
// name, rank facts the accessible rank images and upgrade arrow (DsCrown / DsRank).
import type { GrowthDailyProgress, GrowthEventFact } from '~/types/player-growth';
import { difficultyLabelKey } from '~/utils/difficulty';

const props = defineProps<{ progress: GrowthDailyProgress; original: GrowthDailyProgress }>();
const { t, locale } = useI18n();
const localePath = useLocalePath();
const dateLabel = computed(() => {
  const day = props.progress.calendarDay;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return '';
  const date = new Date(`${day}T00:00:00+08:00`);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(locale.value === 'ja' ? 'ja-JP' : 'zh-CN',
    { month: 'numeric', day: 'numeric', timeZone: 'Asia/Shanghai' }).format(date) : '';
});
const hasChanges = computed(() => props.progress.events.some(event => event.facts.some(fact => fact.type !== 'played')));
const changesElsewhere = computed(() => !hasChanges.value && props.original.events.some(event => event.facts.some(fact => fact.type !== 'played')));
const stateText = computed(() => props.progress.attendance === 'unknown' ? t('home.growth.progressUnavailable')
  : props.progress.attendance === 'not_played' ? t('home.growth.noPlay')
  : changesElsewhere.value ? t('home.growth.dailyElsewhere') : !hasChanges.value ? t('rework.home.daily.quiet') : '');
const factValue = (value: number) => value.toLocaleString(locale.value === 'ja' ? 'ja-JP' : 'zh-CN');
const numericTypes = ['score-pb', 'ng-reduced', 'combo-improved'];
const crownOf = (type: GrowthEventFact['type']) => type === 'df' ? 'dondaful' : type === 'fc' ? 'full' : type === 'clear-upgrade' ? 'clear' : null;
</script>

<template>
  <section class="growth-progress" aria-labelledby="growth-progress-title">
    <header class="growth-progress__head">
      <h2 id="growth-progress-title">{{ t('rework.home.daily.title') }}</h2>
      <span v-if="progress.attendance === 'played' && progress.uniqueCharts !== null" class="growth-progress__count">{{ t('rework.home.daily.count', { count: progress.uniqueCharts }) }}</span>
      <time v-if="dateLabel" :datetime="progress.calendarDay">{{ dateLabel }}</time>
    </header>
    <p v-if="stateText" class="growth-progress__state">{{ stateText }}</p>
    <ul v-if="progress.attendance === 'played' && progress.events.length" class="growth-progress__events">
      <li v-for="(event, eventIndex) in progress.events" :key="`${event.songId}:${event.level}:${event.evidenceRevision}:${eventIndex}`" class="growth-event">
        <NuxtLink :to="localePath({ path: `/songs/${event.songId}`, query: { difficulty: String(event.level) } })" class="growth-event__identity">
          <DsCover :song-id="event.songId" size="sm" />
          <strong>{{ event.title }}</strong>
          <span class="growth-event__diff">{{ t(difficultyLabelKey(event.level)) }}</span>
        </NuxtLink>
        <ul class="growth-event__facts">
          <li v-for="(fact, factIndex) in event.facts" :key="`${fact.type}:${fact.before}:${fact.after}:${factIndex}`">
            <template v-if="numericTypes.includes(fact.type) && fact.after !== null">
              <span class="growth-event__label">{{ t(`home.growth.factLabels.${fact.type}`) }}</span>
              <span class="growth-event__values"><span v-if="fact.before !== null" class="growth-event__before">{{ factValue(fact.before) }} <span aria-hidden="true">→</span> </span><strong>{{ factValue(fact.after) }}</strong><small v-if="fact.type === 'score-pb' && fact.delta !== null && fact.delta > 0"> (+{{ factValue(fact.delta) }})</small></span>
            </template>
            <template v-else-if="fact.type === 'rank-upgrade' && fact.after !== null">
              <DsRank v-if="fact.before !== null" :value="fact.after" :previous="fact.before" variant="upgrade" />
              <DsRank v-else :value="fact.after" />
            </template>
            <DsCrown v-else-if="crownOf(fact.type)" :state="crownOf(fact.type)!" size="sm" text="full" />
            <span v-else>{{ fact.type === 'played' ? t('rework.home.daily.recorded') : t(`home.growth.events.${fact.type}`) }}</span>
          </li>
        </ul>
      </li>
    </ul>
  </section>
</template>
