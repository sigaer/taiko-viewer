<script setup lang="ts">
// One chart of the constants table in detail: cover and title, difficulty, the five ability values as a radar,
// the 75% / 95% / 99% constants on one scale, notes, and the ways on (song detail with this difficulty, the RT
// calculator). Shown in the right column from 1240 px and in a dialog below that (pages/songs/constants.vue).
import type { V2ConstantsItem } from "~/types/content";
import DsRadar from "~/components/ds/charts/Radar.vue";

const props = defineProps<{ row: V2ConstantsItem; headingLevel?: 2 | 3 }>();
const { t, locale } = useI18n();
const localePath = useLocalePath();
const DIFFICULTY_CODE = { hard: 3, oni: 4, edit: 5 } as const;
const code = computed(() => DIFFICULTY_CODE[props.row.difficulty]);
const metricKeys = ["stamina", "handspeed", "burst", "complex", "rhythm"] as const;
const METRIC_KEYS = {
  stamina: "page.songs.v2Constants.columns.stamina",
  handspeed: "page.songs.v2Constants.columns.handspeed",
  burst: "page.songs.v2Constants.columns.burst",
  complex: "page.songs.v2Constants.columns.complex",
  rhythm: "page.songs.v2Constants.columns.rhythm"
} as const;
const axes = computed(() => metricKeys.map((key) => ({ key, label: t(METRIC_KEYS[key]), value: Number(props.row[key]) })));
const domain = computed<[number, number]>(() => [0, Math.max(10, Math.ceil(Math.max(0, ...axes.value.map((a) => a.value))))]);
const fx = (value: number) => Number(value).toFixed(2);
const count = (value: number) => new Intl.NumberFormat(locale.value).format(value);
/** Three constants on one line: positions in whole percent (no float attributes), labels above / below by value. */
const scale = computed(() => {
  const points = [
    { key: "low", label: "75%", value: props.row.subConstant1, main: false },
    { key: "main", label: "95%", value: props.row.mainConstant, main: true },
    { key: "high", label: "99%", value: props.row.subConstant2, main: false }
  ];
  const lo = Math.min(...points.map((p) => p.value));
  const hi = Math.max(...points.map((p) => p.value));
  const pad = Math.max(0.12, (hi - lo) * 0.3);
  const order = [...points].sort((a, b) => a.value - b.value);
  return points.map((p) => ({
    ...p,
    x: Math.round(((p.value - lo + pad) / (hi - lo + pad * 2)) * 100),
    slot: (["lo", "mid", "hi"] as const)[order.indexOf(p)]
  }));
});
const detailTo = computed(() => localePath({ path: `/songs/${props.row.id}`, query: { difficulty: String(code.value) } }));
const rtTo = computed(() => localePath({ path: "/tools/rt-calculator", query: { songId: String(props.row.id), level: String(code.value) } }));
</script>

<template>
  <div class="insp">
    <div class="insp-head">
      <DsCover :song-id="row.id" size="lg" />
      <div class="insp-title">
        <component :is="headingLevel === 3 ? 'h3' : 'h2'" lang="zh-CN" :title="row.songName">{{ row.songName }}</component>
        <p class="num">ID {{ row.id }}</p>
        <DsDiff :difficulty="code" :constant="row.mainConstant" size="lg" />
      </div>
    </div>
    <div class="insp-radar">
      <DsRadar :axes="axes" :domain="domain" :size="232" :name="t('page.songs.v2Constants.groups.dimensions')" />
    </div>
    <h4>{{ t("rework.constantsTable.scale") }}</h4>
    <div class="scale" role="img" :aria-label="`75% ${fx(row.subConstant1)} / 95% ${fx(row.mainConstant)} / 99% ${fx(row.subConstant2)}`">
      <i class="axis" />
      <span v-for="p in scale" :key="p.key" class="tick" :class="[p.slot, { 'is-main': p.main }]" :style="{ left: `${p.x}%` }">
        <span class="lb"><small>{{ p.label }}</small><b class="num">{{ fx(p.value) }}</b></span>
      </span>
    </div>
    <dl class="kv">
      <div><dt>{{ t("page.songs.v2Constants.columns.totalNotes") }}</dt><dd class="num">{{ count(row.totalNotes) }}</dd></div>
      <div v-for="a in axes" :key="a.key"><dt>{{ a.label }}</dt><dd class="num">{{ fx(a.value) }}</dd></div>
    </dl>
    <div class="acts">
      <NuxtLink class="rw-btn rw-btn--primary" :to="detailTo">{{ t("rework.constantsTable.open") }}</NuxtLink>
      <NuxtLink class="rw-btn" :to="rtTo">{{ t("rework.constantsTable.rt") }}</NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.insp {
  display: grid;
  gap: var(--sp-3);
  font-family: var(--font-ui);
  color: var(--ink);
}
.insp-head {
  display: flex;
  align-items: flex-start;
  gap: var(--sp-3);
}
.insp-title {
  display: grid;
  justify-items: start;
  gap: 4px;
  min-width: 0;
}
.insp-title h2,
.insp-title h3 {
  margin: 0;
  font-size: var(--fs-18);
  font-weight: 700;
  line-height: var(--lh-snug);
  overflow-wrap: anywhere;
}
.insp-title p {
  margin: 0;
  font-size: var(--fs-12);
  color: var(--ink-3);
}
.insp-radar {
  display: grid;
  place-items: center;
}
h4 {
  margin: var(--sp-2) 0 0;
  font-size: var(--fs-13);
  font-weight: 600;
  color: var(--ink-2);
}
.scale {
  position: relative;
  height: 104px;
  margin: 0 var(--sp-6);
}
.axis {
  position: absolute;
  left: 0;
  right: 0;
  top: 50px;
  height: 2px;
  border-radius: 1px;
  background: var(--line-strong);
}
.tick {
  position: absolute;
  top: 0;
  width: 0;
  height: 100%;
}
.tick::before {
  content: "";
  position: absolute;
  left: -1px;
  top: 40px;
  width: 2px;
  height: 22px;
  border-radius: 1px;
  background: var(--ink-3);
}
.tick.is-main::before {
  left: -1.5px;
  width: 3px;
  background: var(--series);
}
.lb {
  position: absolute;
  display: flex;
  flex-direction: column;
  line-height: 1.15;
  white-space: nowrap;
}
.lb small {
  font-size: var(--fs-11);
  color: var(--ink-3);
}
.lb b {
  font-size: var(--fs-18);
}
.tick.is-main .lb b {
  color: var(--emph-num);
}
.tick.lo .lb {
  right: 7px;
  top: 4px;
  align-items: flex-end;
}
.tick.hi .lb {
  left: 7px;
  top: 4px;
}
.tick.mid .lb {
  left: 0;
  top: 66px;
  transform: translateX(-50%);
  align-items: center;
}
.kv {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--sp-3);
  margin: 0;
  padding-top: var(--sp-3);
  border-top: 1px solid var(--line);
}
.kv > div {
  display: flex;
  flex-direction: column-reverse;
  min-width: 0;
}
.kv dt {
  font-size: var(--fs-12);
  color: var(--ink-3);
}
.kv dd {
  margin: 0;
  font-size: var(--fs-16);
}
.acts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-2);
  margin-top: var(--sp-2);
}
.acts .rw-btn {
  white-space: normal;
  text-align: center;
}
</style>
