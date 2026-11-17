<script lang="ts">
// DsRank — score rank 0–8 (04 §7.6, 19 G4, 16 A4, P0-18).
// 2–8 show the real asset (small-asset srcset); 0 (not set) and 1 (not obtained) show "—" (rank/1.png is fully
// transparent and never loaded). Names and accessible names come from utils/scoreRank.ts.
// The asset has transparent margins, so it is drawn larger than its slot and centred (slot 24 / draw 28).
//   default  slot 24 / draw 28              detail   slot 36 / draw 40 (song detail score area)
//   compact  slot 20 / draw 24 + name (--fs-11, phone list rows)
//   table    slot 24 / draw 28 + name (--fs-12, dense desktop table; the image is hidden from screen readers)
//   upgrade  previous 24 → new 30 with an --ink-3 arrow
// A slot under 24 px (`slotPx` prop, default/detail only) shows the name instead of the image. Never colour alone:
// the asset carries its glyph (粋 / 雅 / 極) and every variant has the name as text or accessible name.
import { formatScoreRank } from "~/utils/scoreRank";
import { normalizeRankValue, rankAssetName, rankName, smallSrc, type DsSmallSrc } from "~/utils/ds/gameAssets";

export type DsRankVariant = "default" | "detail" | "compact" | "table" | "upgrade";

export interface DsRankMark {
  /** null: no image ("—" or the name as text) */
  sources: DsSmallSrc | null;
  slot: number;
  draw: number;
  /** true when the slot is too small for the image and the name is shown instead */
  textOnly: boolean;
}

/** Slot and draw size for a variant; `slot` overrides default/detail. */
export function rankBox(variant: DsRankVariant, slot = 0): { slot: number; draw: number } {
  if (variant === "compact") return { slot: 20, draw: 24 };
  if (variant === "detail" && !slot) return { slot: 36, draw: 40 };
  const s = slot > 0 ? slot : 24;
  return { slot: s, draw: Math.round((s * 28) / 24) };
}

export function rankMark(value: unknown, variant: DsRankVariant, slot = 0): DsRankMark {
  const box = rankBox(variant, slot);
  const name = rankAssetName(value);
  const textOnly = !!name && variant !== "compact" && box.slot < 24;
  return { ...box, textOnly, sources: name && !textOnly ? smallSrc("rank", name, box.draw) : null };
}

/** Name for any input: 0–8 from scoreRank.ts; anything else is scoreRank.ts's "unknown" name. */
export function rankLabel(value: unknown, locale: string): string {
  return rankName(value, locale) ?? formatScoreRank(value, locale);
}

/** True when the value has a rank image (2–8). */
export const hasRankImage = (value: unknown) => rankAssetName(value) !== null;
export { normalizeRankValue };
</script>

<script setup lang="ts">
import { computed, type PropType } from "vue";
import { useI18n } from "vue-i18n";

const props = defineProps({
  /** bestScoreRank 0–8 (number or numeric string) */
  value: { type: [Number, String] as PropType<number | string | null>, default: null },
  variant: { type: String as PropType<DsRankVariant>, default: "default" },
  /** upgrade only: the rank before */
  previous: { type: [Number, String] as PropType<number | string | null>, default: null },
  /** default / detail: slot override in px (under 24 → name only) */
  slotPx: { type: Number, default: 0 }
});

const { t, locale } = useI18n();
const name = computed(() => rankLabel(props.value, locale.value));
const withName = computed(() => (props.variant === "compact" || props.variant === "table") && hasRankImage(props.value));
const mark = computed(() => rankMark(props.value, props.variant === "upgrade" ? "default" : props.variant, props.variant === "upgrade" ? 30 : props.slotPx));
const before = computed(() => rankMark(props.previous, "default", 24));
const beforeName = computed(() => rankLabel(props.previous, locale.value));
const upgradeName = computed(() => t("ds.rank.upgrade", { from: beforeName.value, to: name.value }));
</script>

<template>
  <span
    v-if="variant === 'upgrade'"
    class="ds-rank ds-rank--upgrade"
    role="img"
    :aria-label="upgradeName"
    :title="upgradeName"
    :data-rank="normalizeRankValue(value) ?? ''"
  >
    <span class="ds-rank__mark" :class="{ 'is-text': before.textOnly }" :style="{ width: `${before.slot}px`, height: `${before.slot}px`, '--ds-rank-draw': `${before.draw}px` }">
      <picture v-if="before.sources" class="ds-rank__picture">
        <source type="image/webp" :srcset="before.sources.webp" />
        <img class="ds-rank__img" :src="before.sources.src" :srcset="before.sources.png" alt="" :width="before.draw" :height="before.draw" decoding="async" />
      </picture>
      <template v-else>—</template>
    </span>
    <svg class="ds-rank__arrow" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M2.5 8h10M9 4.5 12.5 8 9 11.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    <span class="ds-rank__mark" :style="{ width: `${mark.slot}px`, height: `${mark.slot}px`, '--ds-rank-draw': `${mark.draw}px` }">
      <picture v-if="mark.sources" class="ds-rank__picture">
        <source type="image/webp" :srcset="mark.sources.webp" />
        <img class="ds-rank__img" :src="mark.sources.src" :srcset="mark.sources.png" alt="" :width="mark.draw" :height="mark.draw" decoding="async" />
      </picture>
      <template v-else>—</template>
    </span>
  </span>
  <span
    v-else
    class="ds-rank"
    :class="[`ds-rank--${variant}`]"
    :title="withName ? undefined : name"
    :data-rank="normalizeRankValue(value) ?? ''"
  >
    <span
      class="ds-rank__mark"
      :class="{ 'is-text': mark.textOnly }"
      :style="mark.textOnly ? undefined : { width: `${mark.slot}px`, height: `${mark.slot}px`, '--ds-rank-draw': `${mark.draw}px` }"
      :role="withName ? undefined : 'img'"
      :aria-label="withName ? undefined : name"
      :aria-hidden="withName ? 'true' : undefined"
    >
      <picture v-if="mark.sources" class="ds-rank__picture">
        <source type="image/webp" :srcset="mark.sources.webp" />
        <img class="ds-rank__img" :src="mark.sources.src" :srcset="mark.sources.png" alt="" :width="mark.draw" :height="mark.draw" decoding="async" />
      </picture>
      <template v-else-if="mark.textOnly">{{ name }}</template>
      <template v-else>—</template>
    </span>
    <span v-if="withName" class="ds-rank__name">{{ name }}</span>
  </span>
</template>

<style scoped>
.ds-rank {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  vertical-align: middle;
  white-space: nowrap;
}
.ds-rank--compact {
  gap: 6px;
}
.ds-rank--upgrade {
  gap: 6px;
}
.ds-rank__mark {
  display: inline-grid;
  place-items: center;
  flex: none;
  overflow: visible;
  color: var(--ink-3);
  font-size: var(--fs-14);
  line-height: 1;
}
.ds-rank__mark.is-text {
  font-size: var(--fs-12);
  font-weight: 700;
  color: var(--ink-2);
}
.ds-rank__picture {
  display: contents;
}
.ds-rank__img {
  display: block;
  width: var(--ds-rank-draw);
  height: var(--ds-rank-draw);
  max-width: none;
  object-fit: contain;
}
.ds-rank__name {
  font-size: var(--fs-12);
  font-weight: 500;
  color: var(--ink-2);
}
.ds-rank--compact .ds-rank__name {
  font-size: var(--fs-11);
}
.ds-rank__arrow {
  width: 14px;
  height: 14px;
  flex: none;
  color: var(--ink-3);
}
</style>
