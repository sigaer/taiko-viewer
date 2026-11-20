<script lang="ts">
// DsTitlePlate — game title (04 §7.7 game title, 19 G8, 22 D8 / D13, P0-21).
// form="plate" (wide places): the plate image 220px wide at its own aspect ratio, the title 12px in --plate-ink with an
//   --plate-ink-outline outline inside its measured text band. Long titles use
//   10px and horizontal compression while retaining the plate and full text.
//   No plate for the input → --ink-2 text.
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

/** The catalog records each slice's text band and right-side decoration reserve. */
export function plateBand(asset: DsPlateAsset): PlateBand {
  if (asset.textBand) return asset.textBand;
  if (typeof asset.key === "string") return { top: 44, bottom: 86, art: null };
  return { top: asset.height - 41, bottom: asset.height - 3, art: null };
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

/** Prefer 12px; keep 10px text on the plate even when horizontal compression is needed. */
export function fitPlateText(fits: (px: number) => boolean): 12 | 10 {
  if (fits(12)) return 12;
  return 10;
}

export function plateTextScale(textWidth: number, availableWidth: number): number {
  if (!Number.isFinite(textWidth) || !Number.isFinite(availableWidth) || textWidth <= 0 || availableWidth <= 0) return 1;
  return Math.min(1, availableWidth / textWidth);
}
</script>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type PropType } from "vue";

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
const scaleX = ref(1);
const bandEl = ref<HTMLElement | null>(null);
const textEl = ref<HTMLElement | null>(null);
let revision = 0;
let disposed = false;

async function fit() {
  const ticket = ++revision;
  if (disposed) return;
  fontPx.value = 12;
  scaleX.value = 1;
  if (!layout.value || !title.value) return;
  await nextTick();
  if (disposed || ticket !== revision || !textEl.value || !bandEl.value) return;
  const available = Math.max(1, bandEl.value.clientWidth - 2);
  fontPx.value = fitPlateText(() => textEl.value!.scrollWidth <= available);
  if (fontPx.value === 10) {
    await nextTick();
    if (disposed || ticket !== revision || !textEl.value) return;
  }
  scaleX.value = plateTextScale(textEl.value.scrollWidth, available);
}

watch(() => [title.value, asset.value?.key, props.form], fit);
onMounted(() => {
  fit();
  // Re-measure once web fonts have arrived (the first measurement may use a fallback font).
  document.fonts?.ready.then(() => { if (!disposed) return fit(); }).catch(() => {});
});
onBeforeUnmount(() => { disposed = true; revision++; });
</script>

<template>
  <span v-if="title" class="ds-title" :class="[`ds-title--${form}`]" :data-plate="asset ? asset.key : ''">
    <span
      v-if="asset && layout"
      class="ds-title__plate"
      :style="{ width: `${layout.width}px`, height: `${layout.height}px` }"
      :title="title"
    >
      <img class="ds-title__plate-img" :src="asset.src" alt="" :width="layout.width" :height="Math.round(layout.height)" decoding="async" />
      <span
        ref="bandEl"
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
      ><span ref="textEl" class="ds-title__label" :style="{ transform: `translateX(-50%) scaleX(${scaleX})` }">{{ title }}</span></span>
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
.ds-title__label {
  position: absolute;
  top: 0;
  left: 50%;
  display: inline-block;
  width: max-content;
  max-width: none;
  transform-origin: center;
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
