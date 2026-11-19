<script setup lang="ts">
// V2 constants of the selected chart (was components/SongV2Constants.vue). The request now lives in the song detail
// page (same /api/content/songs/:id/v2 call and key), so the difficulty tabs can show the constants too; this
// component only presents one chart: the main constant first and largest, 75% / 99% and notes beside it (the lead of
// the section), then a row of radars — the five ability values here, plus whatever the default slot adds (the page's
// six-dimension radar); side by side from 1100 px, stacked below. Hard / oni / ura oni only (the source has no other difficulties).
import type { V2ConstantsItem } from "~/types/content";
import { Comment, useSlots } from "vue";
import DsRadar from "~/components/ds/charts/Radar.vue";

const props = defineProps<{
  track: string;
  chart: V2ConstantsItem | null | undefined;
  pending: boolean;
  failed: boolean;
}>();
const emit = defineEmits<{ retry: [] }>();
const { t, locale } = useI18n();
const supported = computed(() => ["HARD", "ONI", "EDIT"].includes(props.track));
const metricKeys = ["stamina", "handspeed", "burst", "complex", "rhythm"] as const;
const format = (value: number) => Number(value).toFixed(2);
const count = (value: number) => new Intl.NumberFormat(locale.value).format(value);
const axes = computed(() =>
  props.chart ? metricKeys.map((key) => ({ key, label: t(`rework.songDetail.data.metrics.${key}`), value: Number(props.chart![key]) })) : []
);
/** Fixed scale from 0, rounded up to a whole number (at least 10), so shapes of different charts compare. */
const slots = useSlots();
/** The default slot rendered something other than comments (a v-if that is false leaves only a comment). */
const slotHasContent = () => Boolean(slots.default?.().some((vnode) => vnode.type !== Comment));
const showRadar = computed(() => supported.value && !props.pending && !props.failed && Boolean(props.chart));
const domain = computed<[number, number]>(() => [0, Math.max(10, Math.ceil(Math.max(0, ...axes.value.map((a) => a.value))))]);
</script>

<template>
  <div class="v2" :aria-busy="pending">
    <ReworkState v-if="!supported" kind="empty" compact :title="t('rework.songDetail.data.unsupported')" />
    <ReworkState v-else-if="pending" kind="loading" compact :lines="2" />
    <ReworkState v-else-if="failed" kind="failed" compact :title="t('rework.songDetail.data.failed')" @retry="emit('retry')" />
    <div v-else-if="chart" class="v2-body">
      <dl class="stats">
        <div class="stat is-main">
          <dt>{{ t("rework.songDetail.data.main") }}</dt>
          <dd class="num">{{ format(chart.mainConstant) }}</dd>
        </div>
        <div class="stat">
          <dt>{{ t("rework.songDetail.data.low") }}</dt>
          <dd class="num">{{ format(chart.subConstant1) }}</dd>
        </div>
        <div class="stat">
          <dt>{{ t("rework.songDetail.data.high") }}</dt>
          <dd class="num">{{ format(chart.subConstant2) }}</dd>
        </div>
        <div class="stat">
          <dt>{{ t("rework.songDetail.data.notes") }}</dt>
          <dd class="num">{{ count(chart.totalNotes) }}</dd>
        </div>
      </dl>
    </div>
    <ReworkState v-else kind="empty" compact :title="t('rework.songDetail.data.empty')" />
    <div v-if="showRadar || slotHasContent()" class="radars">
      <figure v-if="showRadar && chart" class="radar v2-radar">
        <figcaption>
          <span class="cap-title">{{ t("rework.songDetail.data.radar") }}</span>
          <span class="cap-meta">
            {{ t("rework.songDetail.data.source") }}
            <a class="rw-link" href="https://github.com/OurTaiko/Constants" target="_blank" rel="noopener noreferrer">OurTaiko / Constants ↗</a>
          </span>
        </figcaption>
        <DsRadar :axes="axes" :domain="domain" :size="248" :name="t('rework.songDetail.data.radar')" />
      </figure>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.stats {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--sp-4) var(--sp-8);
  margin: 0;
}
.stat {
  display: flex;
  flex-direction: column-reverse;
  gap: 2px;
  min-width: 0;
}
.stat dt {
  font-size: var(--fs-12);
  color: var(--ink-3);
}
.stat dd {
  margin: 0;
  font-size: var(--fs-22);
  line-height: 1.1;
  color: var(--ink);
}
.stat.is-main dd {
  font-size: var(--fs-48);
  font-weight: 700;
  color: var(--emph-num);
}
.radars {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--sp-6);
  margin-top: var(--sp-6);
  padding-top: var(--sp-4);
  border-top: 1px solid var(--line);
}
.radars > :only-child {
  grid-column: 1 / -1;
}
.radar {
  display: grid;
  justify-items: center;
  align-content: start;
  gap: var(--sp-2);
  min-width: 0;
  margin: 0;
}
figcaption {
  justify-self: stretch;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--sp-1) var(--sp-3);
}
.cap-title {
  font-size: var(--fs-13);
  font-weight: 600;
  color: var(--ink-2);
}
.cap-meta {
  font-size: var(--fs-12);
  color: var(--ink-3);
}
@media (max-width: 1099px) {
  .radars {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 767px) {
  .stat.is-main dd {
    font-size: var(--fs-36);
  }
  .stats {
    gap: var(--sp-3) var(--sp-5);
  }
}
</style>
