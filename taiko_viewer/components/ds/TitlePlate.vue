<script lang="ts">
// DsTitlePlate — game title (04 §7.7 game title, 19 G8, 22 D8 / D13, P0-21).
// form="plate" (wide places): the plate image 220px wide at its own aspect ratio, the title 12px in --plate-ink with an
//   --plate-ink-outline outline inside the plate's text band (clear of the character art on 59 / 60 / 61). Too long →
//   10px → the text form; the full title is always in `title`. No plate for the input → --ink-2 text.
// form="text" (narrow places): --ink-3, --fs-12, one line with ellipsis.
// The plate comes only from an explicit mapping (utils/ds/gameAssets.ts); nothing is guessed. No title → nothing.
// There is no "rare" title.
import { customTitlePlateForStyle, titlePlateAsset, type DsPlateAsset } from "~/utils/ds/gameAssets";

export type DsTitleForm = "plate" | "text";
export const DS_PLATE_WIDTH = 220;

/** Text band of a plate in source pixels: [top, bottom) rows, and the column where character art starts. */
interface PlateBand {
  top: number;
  bottom: number;
  art: number | null;
}
const ART_PLATES = new Set([59, 60, 61]);

/** Measured from the slices: 45px slices are one band; on 71px slices the band is rows 30–68 (the top is art or
 * transparent); custom 556×90 plates have the name area in rows 44–86; 59 / 60 / 61 carry art from column 467. */
export function plateBand(asset: DsPlateAsset): PlateBand {
  if (typeof asset.key === "string") return { top: 44, bottom: 86, art: null };
  if (asset.height === 45) return { top: 4, bottom: 42, art: null };
  return { top: 30, bottom: 68, art: ART_PLATES.has(asset.key) ? 467 : null };
}

export interface PlateLayout {
  width: number;
  height: number;
  text: { top: number; height: number; left: number; right: number };
}

/** Box of the plate at 220px (height unrounded, so the ratio is exact) and of its text band (CSS px). */
export function plateLayout(asset: DsPlateAsset, width = DS_PLATE_WIDTH): PlateLayout {
  const k = width / asset.width;
  const band = plateBand(asset);
  const right = band.art ? Math.max(22, Math.ceil((asset.width - band.art) * k) + 6) : 22;
  return {
    width,
    height: asset.height * k,
    text: { top: band.top * k, height: (band.bottom - band.top) * k, left: 22, right }
  };
}

/** The plate for a title: an explicit plate id / custom key, or the My-Don plateStyle; otherwise null (D13). */
export function resolveTitlePlate(plate: unknown, plateStyle: unknown): DsPlateAsset | null {
  return titlePlateAsset(plate) ?? customTitlePlateForStyle(plateStyle);
}

/** Text fitting: 12px, then 10px, then the text form. `fits(px)` reports whether the title fits at that size. */
export function fitPlateText(fits: (px: number) => boolean): 12 | 10 | "text" {
  if (fits(12)) return 12;
  if (fits(10)) return 10;
  return "text";
}
</script>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch, type PropType } from "vue";

const props = defineProps({
  /** Title text; empty / null = no title (nothing is rendered) */
  name: { type: String as PropType<string | null>, default: null },
  /** Plate id (verifiedTitleplateId / plateId) or custom plate key */
  plate: { type: [Number, String] as PropType<number | string | null>, default: null },
  /** My-Don custom title style: silver / gold / rainbow */
  plateStyle: { type: String as PropType<string | null>, default: null },
  form: { type: String as PropType<DsTitleForm>, default: "plate" },
  /** Language of the title text when it differs from the page (game titles are mostly Japanese) */
  lang: { type: String, default: undefined }
});

const title = computed(() => (typeof props.name === "string" ? props.name.trim() : ""));
const asset = computed(() => (props.form === "plate" ? resolveTitlePlate(props.plate, props.plateStyle) : null));
const layout = computed(() => (asset.value ? plateLayout(asset.value) : null));
const fontPx = ref<12 | 10>(12);
const fallback = ref(false);
const textEl = ref<HTMLElement | null>(null);

async function fit() {
  fontPx.value = 12;
  fallback.value = false;
  if (!layout.value || !title.value) return;
  await nextTick();
  const measure = async (px: 12 | 10) => {
    fontPx.value = px;
    await nextTick();
    const el = textEl.value;
    return !el || el.scrollWidth <= el.clientWidth;
  };
  const fits12 = await measure(12);
  const fits10 = fits12 ? true : await measure(10);
  const result = fitPlateText((px) => (px === 12 ? fits12 : fits10));
  if (result === "text") fallback.value = true;
  else fontPx.value = result;
}

watch(() => [title.value, asset.value?.key, props.form], fit);
onMounted(() => {
  fit();
  // Re-measure once web fonts have arrived (the first measurement may use a fallback font).
  document.fonts?.ready.then(fit).catch(() => {});
});
</script>

<template>
  <span v-if="title" class="ds-title" :class="[`ds-title--${form}`]" :data-plate="asset && !fallback ? asset.key : ''">
    <span
      v-if="asset && layout && !fallback"
      class="ds-title__plate"
      :style="{ width: `${layout.width}px`, height: `${layout.height}px` }"
      :title="title"
    >
      <img class="ds-title__plate-img" :src="asset.src" alt="" :width="layout.width" :height="Math.round(layout.height)" decoding="async" />
      <span
        ref="textEl"
        class="ds-title__on-plate"
        :lang="lang"
        :style="{
          top: `${layout.text.top}px`,
          height: `${layout.text.height}px`,
          lineHeight: `${layout.text.height}px`,
          left: `${layout.text.left}px`,
          right: `${layout.text.right}px`,
          fontSize: `${fontPx}px`
        }"
      >{{ title }}</span>
    </span>
    <span v-else class="ds-title__text" :class="{ 'is-strong': form === 'plate' }" :lang="lang" :title="title">{{ title }}</span>
  </span>
</template>

<style scoped>
.ds-title {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  max-width: 100%;
  vertical-align: middle;
}
.ds-title__plate {
  position: relative;
  display: inline-block;
  flex: none;
}
.ds-title__plate-img {
  display: block;
  width: 100%;
  height: 100%;
}
.ds-title__on-plate {
  position: absolute;
  display: block;
  overflow: hidden;
  text-align: center;
  white-space: nowrap;
  font-weight: 700;
  color: var(--plate-ink);
  text-shadow:
    1px 0 0 var(--plate-ink-outline),
    -1px 0 0 var(--plate-ink-outline),
    0 1px 0 var(--plate-ink-outline),
    0 -1px 0 var(--plate-ink-outline),
    1px 1px 0 var(--plate-ink-outline),
    -1px -1px 0 var(--plate-ink-outline),
    1px -1px 0 var(--plate-ink-outline),
    -1px 1px 0 var(--plate-ink-outline);
}
.ds-title__text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--fs-12);
  color: var(--ink-3);
}
.ds-title__text.is-strong {
  color: var(--ink-2);
  font-weight: 700;
}
</style>
