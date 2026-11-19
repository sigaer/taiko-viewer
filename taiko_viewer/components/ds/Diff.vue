<script lang="ts">
// DsDiff — difficulty badge: icon + ★star + constant (04 §7.4 badge, 16 A2, P0-19).
// Icon /icons/diff/{1–5}.png in a square box with object-fit: contain (the files are 86–101 × 78–86 px; never
// stretched). Neutral container. Ura oni shares the oni icon shape, so the 里 / 裏 mark follows the icon.
// No difficulty character inside the badge; the accessible name reads the full difficulty name, star and constant.
// Missing constant → "—" (--ink-3). Star normalisation reuses utils/difficulty.ts.
import { normalizeDifficultyType, resolveChartStarLevel, type DifficultyType } from "~/utils/difficulty";
import { diffIconSrc } from "~/utils/ds/gameAssets";

export type DsDiffSize = "md" | "lg";
export const DS_DIFF_ICON_PX: Readonly<Record<DsDiffSize, number>> = Object.freeze({ md: 18, lg: 22 });

/** Star level for a difficulty from a raw level value (number or numeric string); null when missing or ≤ 0. */
export function diffStar(difficulty: DifficultyType, level: unknown): number | null {
  const song = { level_1: null, level_2: null, level_3: null, level_4: null, level_5: null, [`level_${difficulty}`]: level };
  return resolveChartStarLevel(song as unknown as Parameters<typeof resolveChartStarLevel>[0], difficulty);
}

/** Constant shown with two decimals (as SongV2Constants.vue); null when missing or not a finite number. */
export function diffConstant(value: unknown): string | null {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n.toFixed(2) : null;
}

export { diffIconSrc, normalizeDifficultyType };
</script>

<script setup lang="ts">
import { computed, type PropType } from "vue";
import { useI18n } from "vue-i18n";

const props = defineProps({
  /** 1–5: easy, normal, hard, oni, ura oni (number or numeric string) */
  difficulty: { type: [Number, String] as PropType<number | string>, required: true },
  /** level_{n} star value */
  star: { type: [Number, String] as PropType<number | string | null>, default: null },
  /** V2 constant (hard / oni / edit only) */
  constant: { type: [Number, String] as PropType<number | string | null>, default: null },
  size: { type: String as PropType<DsDiffSize>, default: "md" },
  /** false where the data source has no constants (the song library list): no "—" slot, no constant in the name */
  showConstant: { type: Boolean, default: true }
});

const { t } = useI18n();
const difficulty = computed(() => normalizeDifficultyType(props.difficulty));
const icon = computed(() => diffIconSrc(difficulty.value));
const px = computed(() => DS_DIFF_ICON_PX[props.size] ?? DS_DIFF_ICON_PX.md);
const star = computed(() => (difficulty.value ? diffStar(difficulty.value, props.star) : null));
const constant = computed(() => diffConstant(props.constant));
const fullName = computed(() => (difficulty.value ? t(`difficulty.${difficulty.value}`) : ""));
const label = computed(() =>
  [
    fullName.value,
    star.value !== null ? t("ds.diff.star", { n: star.value }) : "",
    !props.showConstant ? "" : constant.value !== null ? t("ds.diff.constant", { value: constant.value }) : t("ds.diff.noConstant")
  ]
    .filter(Boolean)
    .join(" ")
);
</script>

<template>
  <span
    v-if="difficulty && icon"
    class="ds-diff"
    :class="[`ds-diff--${size}`]"
    role="img"
    :aria-label="label"
    :title="fullName"
    :data-difficulty="difficulty"
  >
    <span class="ds-diff__icon" :style="{ width: `${px}px`, height: `${px}px` }">
      <img class="ds-diff__img" :src="icon" alt="" :width="px" :height="px" decoding="async" />
    </span>
    <span v-if="difficulty === 5" class="ds-diff__ura">{{ t("ds.diff.ura") }}</span>
    <span v-if="star !== null" class="ds-diff__star num">★{{ star }}</span>
    <template v-if="showConstant">
      <span v-if="constant !== null" class="ds-diff__constant num">{{ constant }}</span>
      <span v-else class="ds-diff__constant is-missing">—</span>
    </template>
  </span>
</template>

<style scoped>
.ds-diff {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 6px 0 3px;
  border: 1px solid var(--line);
  border-radius: var(--r-xs);
  background: var(--surface);
  color: var(--ink);
  font-size: var(--fs-14);
  line-height: 1;
  white-space: nowrap;
  vertical-align: middle;
  flex: none;
}
.ds-diff--lg {
  height: 28px;
  padding: 0 7px 0 3px;
  font-size: var(--fs-16);
}
.ds-diff__icon {
  display: inline-grid;
  place-items: center;
  flex: none;
}
.ds-diff__img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.ds-diff__ura {
  margin-left: -2px;
  font-size: var(--fs-12);
  font-weight: 700;
  color: var(--ink-2);
}
.ds-diff .ds-diff__star {
  font-weight: 700;
  color: var(--ink);
}
.ds-diff__constant {
  color: var(--ink-2);
}
.ds-diff__constant.is-missing {
  color: var(--ink-3);
}
</style>
