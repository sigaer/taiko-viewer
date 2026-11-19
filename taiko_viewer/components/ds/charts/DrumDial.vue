<script setup lang="ts">
// Drum dial (P0-25; 04 §3, §9; V1.2 §9.24): a ring of rivets on the drum rim, one per `step` up to `max`
// (Rating 15.5 / 0.5 → 31), from 7:30 clockwise over 270°. Lit rivets use the brand series colour; a remainder
// lights one rivet half. The centre shows the slot content, or the value when no slot is given.
// The whole dial is one image with a locale-built name (ds.chart.dial.summary); the drawing itself is hidden.
import { dialRivets, formatFixed } from "~/utils/ds/charts";

const props = withDefaults(
  defineProps<{
    value: number | null;
    max?: number;
    step?: number;
    size?: number;
    digits?: number;
    tone?: "series" | "mark";
    /** Accessible name, e.g. "Rating"; defaults to ds.chart.dial.name. */
    name?: string;
  }>(),
  { max: 15.5, step: 0.5, size: 168, digits: 2, tone: "series", name: "" }
);

const { t } = useI18n();
const rivets = computed(() => dialRivets(props.value, props.max, props.step));
const ariaLabel = computed(() =>
  t("ds.chart.dial.summary", { name: props.name || t("ds.chart.dial.name"), value: formatFixed(props.value, props.digits), max: formatFixed(props.max, props.digits) })
);
</script>

<template>
  <div class="ds-dial" :class="`ds-dial--${tone}`" :style="{ inlineSize: `${size}px`, blockSize: `${size}px` }" role="img" :aria-label="ariaLabel">
    <svg viewBox="0 0 120 120" aria-hidden="true" class="ds-dial__svg">
      <circle cx="60" cy="60" r="43" class="ds-dial__face" />
      <circle cx="60" cy="60" r="43" class="ds-dial__rim" />
      <circle v-for="(r, i) in rivets" :key="i" :cx="r.x" :cy="r.y" :r="r.state === 'off' ? 1.7 : 2.6" class="ds-dial__rivet" :class="`is-${r.state}`" />
    </svg>
    <div class="ds-dial__mid" aria-hidden="true">
      <slot>
        <b class="num ds-dial__value">{{ formatFixed(value, digits) }}</b>
      </slot>
    </div>
  </div>
</template>

<style scoped>
.ds-dial {
  --tone: var(--series);
  position: relative;
  flex: none;
  max-inline-size: 100%;
}
.ds-dial--mark {
  --tone: var(--chart-mark);
}
.ds-dial__svg {
  display: block;
  inline-size: 100%;
  block-size: 100%;
}
.ds-dial__face {
  fill: var(--surface-2);
}
.ds-dial__rim {
  fill: none;
  stroke: var(--line-strong);
  stroke-width: 1;
}
.ds-dial__rivet {
  fill: var(--line-strong);
}
.ds-dial__rivet.is-on {
  fill: var(--tone);
}
.ds-dial__rivet.is-half {
  fill: color-mix(in srgb, var(--tone) 50%, var(--line-strong));
}
.ds-dial__mid {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  text-align: center;
  color: var(--ink);
}
.ds-dial__value {
  font-size: var(--fs-28);
  font-weight: 700;
  line-height: var(--lh-tight);
}
</style>
