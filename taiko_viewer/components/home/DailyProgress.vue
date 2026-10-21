<script setup lang="ts">
import type { GrowthDailyProgress, GrowthEventFact } from '~/types/player-growth';
import { difficultyLabelKey } from '~/utils/difficulty';
import { formatScoreRank } from '~/utils/scoreRank';

const props = defineProps<{ progress: GrowthDailyProgress; original: GrowthDailyProgress }>();
const { t, locale } = useI18n();
const localePath = useLocalePath();
const copy = computed(() => locale.value === 'ja'
  ? { title: '今日の進捗', count: (n: number) => `${n}譜面をプレイ`, recorded: 'プレイ記録あり', quiet: 'プレイ記録はありますが、成績の変化はまだ確認できません。' }
  : { title: '今日进展', count: (n: number) => `游玩 ${n} 张谱面`, recorded: '已记录游玩', quiet: '已记录游玩，暂无可确认的成绩变化。' });
const dateLabel = computed(() => {
  const day = props.progress.calendarDay;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return '';
  const date = new Date(`${day}T00:00:00+08:00`);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(locale.value === 'ja' ? 'ja-JP' : 'zh-CN',
    { month: 'numeric', day: 'numeric', timeZone: 'Asia/Shanghai' }).format(date) : '';
});
const hasChanges = computed(() => props.progress.events.some(event => event.facts.some(fact => fact.type !== 'played')));
const changesElsewhere = computed(() => !props.progress.events.length && props.original.events.some(event => event.facts.some(fact => fact.type !== 'played')));
const stateText = computed(() => props.progress.attendance === 'unknown' ? t('home.growth.progressUnavailable')
  : props.progress.attendance === 'not_played' ? t('home.growth.noPlay')
  : changesElsewhere.value ? t('home.growth.dailyElsewhere') : !hasChanges.value ? copy.value.quiet : '');
const factValue = (fact: GrowthEventFact, value: number) => fact.type === 'rank-upgrade'
  ? formatScoreRank(value, locale.value) : value.toLocaleString(locale.value === 'ja' ? 'ja-JP' : 'zh-CN');
const numericTypes = ['score-pb', 'ng-reduced', 'combo-improved', 'rank-upgrade'];
</script>

<template>
  <section class="growth-progress" aria-labelledby="growth-progress-title">
    <header class="growth-progress__head">
      <div class="growth-progress__summary">
        <h2 id="growth-progress-title">{{ copy.title }}</h2>
        <span v-if="progress.attendance === 'played' && progress.uniqueCharts !== null" class="growth-progress__count">{{ copy.count(progress.uniqueCharts) }}</span>
      </div>
      <time v-if="dateLabel" :datetime="progress.calendarDay">{{ dateLabel }}</time>
    </header>
    <p v-if="stateText" class="growth-progress__state">{{ stateText }}</p>
    <div v-if="progress.attendance === 'played' && progress.events.length" class="growth-progress__events">
      <article v-for="(event, eventIndex) in progress.events" :key="`${event.songId}:${event.level}:${event.evidenceRevision}:${eventIndex}`" class="growth-event">
        <NuxtLink :to="localePath({ path: `/songs/${event.songId}`, query: { difficulty: String(event.level) } })" class="growth-event__identity">
          <strong>{{ event.title }}</strong>
          <span>{{ t(difficultyLabelKey(event.level)) }}</span>
        </NuxtLink>
        <ul class="growth-event__facts">
          <li v-for="(fact, factIndex) in event.facts" :key="`${fact.type}:${fact.before}:${fact.after}:${factIndex}`">
            <template v-if="numericTypes.includes(fact.type) && fact.after !== null">
              <span class="growth-event__label">{{ t(`home.growth.factLabels.${fact.type}`) }}</span>
              <span class="growth-event__values"><span v-if="fact.before !== null" class="growth-event__before">{{ factValue(fact, fact.before) }} <span aria-hidden="true">→</span> </span><strong>{{ factValue(fact, fact.after) }}</strong><small v-if="fact.type === 'score-pb' && fact.delta !== null && fact.delta > 0"> (+{{ factValue(fact, fact.delta) }})</small></span>
            </template>
            <span v-else>{{ fact.type === 'played' ? copy.recorded : t(`home.growth.events.${fact.type}`) }}</span>
          </li>
        </ul>
      </article>
    </div>
  </section>
</template>

<style scoped>
.growth-progress { display: grid; gap: 12px; min-width: 0; }
.growth-progress__head, .growth-progress__summary { display: flex; align-items: baseline; gap: 10px 16px; flex-wrap: wrap; }
.growth-progress__head { justify-content: space-between; }
.growth-progress h2 { margin: 0; color: var(--viewer-text); font: 600 22px/1.4 var(--viewer-display-font); }
.growth-progress__count, .growth-progress time { color: var(--viewer-text-muted); font-size: 13px; }
.growth-progress__state { margin: 0; color: var(--viewer-text-muted); font-size: 14px; line-height: 1.6; }
.growth-progress__events { display: grid; gap: 0; }
.growth-event { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); gap: 10px 24px; padding-block: 14px; border-top: 1px solid var(--viewer-border); }
.growth-event__identity { min-width: 0; display: grid; gap: 4px; align-content: start; color: var(--viewer-link); text-decoration: none; }
.growth-event__identity strong { font-size: 16px; line-height: 1.5; font-weight: 600; overflow-wrap: anywhere; }
.growth-event__identity span { color: var(--viewer-text-muted); font-size: 13px; }
.growth-event__identity:focus-visible { outline: 3px solid var(--viewer-link); outline-offset: 3px; }
.growth-event__facts { display: grid; gap: 6px; align-content: start; margin: 0; padding: 0; list-style: none; color: var(--viewer-text); font-size: 14px; }
.growth-event__facts li { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 12px; }
.growth-event__label, .growth-event__before, .growth-event__values small { color: var(--viewer-text-muted); }
.growth-event__values { font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.growth-event__values strong { font-size: 16px; font-weight: 600; }
.growth-event__values small { font-size: 13px; }
@media (max-width: 680px) { .growth-event { grid-template-columns: minmax(0, 1fr); gap: 8px; } }
</style>
