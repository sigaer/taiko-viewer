<script lang="ts">
// DsCover — song cover (04 §7.3, 22 D5, P0-16).
// Load order, same song only: thumbnail WebP (srcset 200w / 400w) → original PNG → neutral placeholder.
// Never another song's cover (no fallbackSongId). The original after a thumbnail failure carries the production
// cache-bypass `?v=` (components/SongCoverImage.vue): Bot uploads new covers and the edge may hold an earlier 404.
// Image URLs are set only after mount, so an image cannot fail before hydration with nobody listening.
import { buildSongCoverOriginalUrl, buildSongCoverThumbnailSrcset, buildSongCoverThumbnailUrl } from "~/utils/songCover";

export type DsCoverSize = "sm" | "md" | "lg" | "tile" | "xl" | "fill";
/** Display width per size (px); `fill` uses its measured width, this is only the first guess. */
export const DS_COVER_PX: Readonly<Record<DsCoverSize, number>> = Object.freeze({ sm: 32, md: 44, lg: 72, tile: 96, xl: 168, fill: 168 });

/** 0 thumbnail · 1 original · 2 placeholder */
export type DsCoverStage = 0 | 1 | 2;

export interface DsCoverSources {
  src: string;
  srcset?: string;
  sizes?: string;
}

export const isCoverSongId = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;

/** Image attributes for a stage; null for the placeholder or an unusable id. `retry` is the cache-bypass token. */
export function coverSources(songId: unknown, stage: DsCoverStage, width: number, retry = ""): DsCoverSources | null {
  if (!isCoverSongId(songId) || stage >= 2) return null;
  if (stage === 0) {
    return {
      src: buildSongCoverThumbnailUrl(songId, 200),
      srcset: buildSongCoverThumbnailSrcset(songId),
      sizes: `${Math.max(1, Math.round(width))}px`
    };
  }
  return { src: buildSongCoverOriginalUrl(songId) + (retry ? `?v=${retry}` : "") };
}

/** Same token as SongCoverImage.vue: changes every five minutes. */
export const coverRetryToken = (now: number) => String(Math.floor(now / 300000));

const NEAR_MARGIN = "320px 0px";
let sharedObserver: IntersectionObserver | null = null;
const nearCallbacks = new WeakMap<Element, () => void>();

/** One IntersectionObserver for every cover (client only; called from onMounted). Returns a cancel function. */
function whenNear(el: Element, callback: () => void): () => void {
  if (typeof IntersectionObserver === "undefined") {
    callback();
    return () => {};
  }
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const cb = nearCallbacks.get(entry.target);
          sharedObserver?.unobserve(entry.target);
          nearCallbacks.delete(entry.target);
          cb?.();
        }
      },
      { rootMargin: NEAR_MARGIN }
    );
  }
  nearCallbacks.set(el, callback);
  sharedObserver.observe(el);
  return () => {
    if (!nearCallbacks.has(el)) return;
    nearCallbacks.delete(el);
    sharedObserver?.unobserve(el);
  };
}
</script>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, type PropType } from "vue";
import { useI18n } from "vue-i18n";

const props = defineProps({
  /** Song id (SongCatalogItem.id); anything else shows the placeholder without a request. */
  songId: { type: Number as PropType<number | null>, default: null },
  size: { type: String as PropType<DsCoverSize>, default: "md" },
  /** Main cover above the fold: load at once with high fetch priority. */
  priority: { type: Boolean, default: false },
  /** Accessible name when the cover is not next to its title; otherwise the image is decorative. */
  label: { type: String, default: "" }
});

const { t } = useI18n();
const root = ref<HTMLElement | null>(null);
const near = ref(false);
const stage = ref<DsCoverStage>(0);
const loaded = ref(false);
const retry = ref("");
const width = ref(DS_COVER_PX[props.size] ?? 44);
let cancelNear: (() => void) | null = null;

const missing = computed(() => !isCoverSongId(props.songId) || stage.value >= 2);
const sources = computed(() => (near.value ? coverSources(props.songId, stage.value, width.value, retry.value) : null));

function queue() {
  cancelNear?.();
  cancelNear = null;
  if (missing.value || !root.value) return;
  if (props.size === "fill") width.value = root.value.getBoundingClientRect().width || width.value;
  if (props.priority) {
    near.value = true;
    return;
  }
  cancelNear = whenNear(root.value, () => {
    cancelNear = null;
    near.value = true;
  });
}

function onLoad() {
  loaded.value = true;
}
function onError() {
  loaded.value = false;
  if (stage.value === 0) {
    retry.value = coverRetryToken(Date.now());
    stage.value = 1;
  } else {
    stage.value = 2;
  }
}

// Another song: back to the base colour first, then queue again.
watch(
  () => props.songId,
  () => {
    stage.value = 0;
    loaded.value = false;
    retry.value = "";
    near.value = false;
    queue();
  }
);

onMounted(queue);
onBeforeUnmount(() => cancelNear?.());

const name = computed(() => (missing.value ? t("ds.cover.missing") : props.label));
</script>

<template>
  <span
    ref="root"
    class="ds-cover"
    :class="[`ds-cover--${size}`, { 'is-missing': missing, 'is-loaded': loaded }]"
    :role="name ? 'img' : undefined"
    :aria-label="name || undefined"
    :aria-hidden="name ? undefined : 'true'"
    :title="missing ? name : undefined"
    :data-stage="missing ? 2 : stage"
  >
    <img
      v-if="sources && !missing"
      :key="`${songId}-${stage}`"
      class="ds-cover__img"
      :src="sources.src"
      :srcset="sources.srcset"
      :sizes="sources.sizes"
      alt=""
      width="400"
      height="400"
      decoding="async"
      :fetchpriority="priority ? 'high' : undefined"
      @load="onLoad"
      @error="onError"
    />
    <span v-if="!missing" class="ds-cover__veil" aria-hidden="true" />
    <svg v-else class="ds-cover__note" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M9 17.5V6.2l10-2.2v11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      <ellipse cx="6.6" cy="17.6" rx="2.6" ry="2.2" fill="currentColor" />
      <ellipse cx="16.6" cy="15.2" rx="2.6" ry="2.2" fill="currentColor" />
    </svg>
  </span>
</template>

<style scoped>
.ds-cover {
  position: relative;
  display: inline-grid;
  place-items: center;
  flex: none;
  width: 44px;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: var(--r-ctl);
  background: var(--bg-sunk);
  color: var(--ink-3);
  vertical-align: middle;
}
/* 1px inner line on top of the image */
.ds-cover::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 2;
  border-radius: inherit;
  box-shadow: inset 0 0 0 1px var(--line);
  pointer-events: none;
}
.ds-cover--sm {
  width: 32px;
  border-radius: var(--r-xs);
}
.ds-cover--lg {
  width: 72px;
  border-radius: calc(var(--r-ctl) + 2px);
}
.ds-cover--tile {
  width: 96px;
  border-radius: calc(var(--r-ctl) + 2px);
}
.ds-cover--xl {
  width: 168px;
  border-radius: var(--r-panel);
}
.ds-cover--fill {
  display: grid;
  width: 100%;
}
.ds-cover__img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
/* Fade-in: a base-colour veil above the image clears in 120 ms once it has loaded (the image itself is untouched). */
.ds-cover__veil {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: var(--bg-sunk);
  transition: opacity var(--dur-1) ease-out;
}
.ds-cover.is-loaded .ds-cover__veil {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .ds-cover__veil {
    transition: none;
  }
}
.ds-cover__note {
  width: 40%;
  max-width: 40px;
  height: auto;
  aspect-ratio: 1;
}
</style>
