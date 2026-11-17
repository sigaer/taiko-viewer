<script lang="ts">
// DsCrown — crown state (04 §7.5, 16 A3, D0-6 interface, P0-17).
// Input is the state from utils/ds/crown.ts (crownFromCounts). dondaful / full / clear use the real asset through
// the small-asset srcset; played is an 8px ring; none is "—". No grey crown, no plate or colour ring behind the asset.
// `text` (D0-6): off (default, 04 as written) / short / full. Text sits beside the asset, never on it; when text is
// visible the mark is hidden from screen readers so the state is read once.
import { crownAssetName, crownLabelKey, type DsCrownState } from "~/utils/ds/crown";
import { smallSrc, type DsSmallSrc } from "~/utils/ds/gameAssets";

export type DsCrownSize = "chip" | "table" | "sm" | "md" | "lg" | "xl";
export type DsCrownText = "off" | "short" | "full";

export const DS_CROWN_PX: Readonly<Record<DsCrownSize, number>> = Object.freeze({ chip: 16, table: 18, sm: 18, md: 22, lg: 30, xl: 48 });

/** Small-asset candidates for a state at a size; null for played / none. */
export function crownSources(state: DsCrownState, size: DsCrownSize): DsSmallSrc | null {
  const name = crownAssetName(state);
  return name ? smallSrc("crown", name, DS_CROWN_PX[size] ?? DS_CROWN_PX.md) : null;
}

/** locale key of the short visible name (provisional wording until stage 2). */
export const crownShortKey = (state: DsCrownState) => `ds.crown.short.${state}`;
export { crownLabelKey };
</script>

<script setup lang="ts">
import { computed, type PropType } from "vue";
import { useI18n } from "vue-i18n";
import { isDsCrownState } from "~/utils/ds/crown";

const props = defineProps({
  state: { type: String as PropType<DsCrownState>, required: true },
  size: { type: String as PropType<DsCrownSize>, default: "md" },
  text: { type: String as PropType<DsCrownText>, default: "off" }
});

const { t } = useI18n();
const current = computed<DsCrownState>(() => (isDsCrownState(props.state) ? props.state : "none"));
const px = computed(() => DS_CROWN_PX[props.size] ?? DS_CROWN_PX.md);
const sources = computed(() => crownSources(current.value, props.size));
const fullName = computed(() => t(crownLabelKey(current.value)));
const visible = computed(() => (props.text === "full" ? fullName.value : props.text === "short" ? t(crownShortKey(current.value)) : ""));
/** A short name that differs from the full one is shown to the eye; the full name is what screen readers get. */
const shortOnly = computed(() => props.text === "short" && visible.value !== fullName.value);
</script>

<template>
  <span class="ds-crown" :class="[`ds-crown--${size}`, `is-${current}`]" :title="visible ? undefined : fullName" :data-state="current">
    <span
      class="ds-crown__mark"
      :style="{ width: `${px}px`, height: `${px}px` }"
      :role="visible ? undefined : 'img'"
      :aria-label="visible ? undefined : fullName"
      :aria-hidden="visible ? 'true' : undefined"
    >
      <picture v-if="sources" class="ds-crown__picture">
        <source type="image/webp" :srcset="sources.webp" />
        <img class="ds-crown__img" :src="sources.src" :srcset="sources.png" alt="" :width="px" :height="px" decoding="async" />
      </picture>
      <span v-else-if="current === 'played'" class="ds-crown__ring" />
      <span v-else class="ds-crown__none">—</span>
    </span>
    <span v-if="visible" class="ds-crown__text" :aria-hidden="shortOnly ? 'true' : undefined">{{ visible }}</span>
    <span v-if="shortOnly" class="ds-crown__sr">{{ fullName }}</span>
  </span>
</template>

<style scoped>
.ds-crown {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  vertical-align: middle;
  white-space: nowrap;
}
.ds-crown__mark {
  display: inline-grid;
  place-items: center;
  flex: none;
  color: var(--ink-3);
  font-size: var(--fs-14);
  line-height: 1;
}
.ds-crown__picture {
  display: contents;
}
.ds-crown__img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.ds-crown__ring {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1.5px solid var(--ink-3);
}
.ds-crown__text {
  font-size: var(--fs-13);
  font-weight: 500;
  color: var(--ink-2);
}
.ds-crown--chip .ds-crown__text,
.ds-crown--table .ds-crown__text,
.ds-crown--sm .ds-crown__text {
  font-size: var(--fs-12);
}
.ds-crown--lg .ds-crown__text {
  font-size: var(--fs-14);
}
.ds-crown--xl .ds-crown__text {
  font-size: var(--fs-16);
  font-weight: 600;
}
.ds-crown__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
