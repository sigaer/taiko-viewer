<script setup lang="ts">
// The three chart actions of the song detail page for the selected difficulty and side: practice player (primary,
// only with a TJA bundle), full chart image, TJA+OGG download (only with a TJA bundle). Same links as before.
//   head  stacked in the header card (≥ 768 px; hidden below, where the dock carries them)
//   dock  the phone bottom bar (< 768 px): fixed above the bottom navigation, hidden while the soft keyboard is open
//         (html[data-kb]). On Firefox Android it is teleported into the shell's #viewer-shell-dock, a static flex
//         child of the fixed shell (the same mechanism as the community reply box).
import type { PropType } from "vue";
import { chartImageUrl } from "./ChartSheet.vue";

defineProps({
  songId: { type: Number, required: true },
  difficulty: { type: Number, required: true },
  side: { type: String, default: "single" },
  tjaBundleUrl: { type: String, default: "" },
  variant: { type: String as PropType<"head" | "dock">, default: "head" }
});
const { t } = useI18n();
const localePath = useLocalePath();
const firefoxShell = useFirefoxAndroidShell();
</script>

<template>
  <div v-if="variant === 'head'" class="chart-actions sa-head">
    <NuxtLink v-if="tjaBundleUrl" class="rw-btn rw-btn--primary sa-btn" :to="localePath(`/ourtaikoview/${songId}/${difficulty}`)" target="_blank" rel="noopener noreferrer">
      <ReworkIcon name="play" class="sa-ic" />{{ t("rework.songDetail.chart.practice") }}
    </NuxtLink>
    <a class="rw-btn sa-btn" :href="chartImageUrl(songId, difficulty, side)" target="_blank" rel="noopener noreferrer">{{ t("rework.songDetail.chart.open") }} ↗</a>
    <a v-if="tjaBundleUrl" class="rw-btn sa-btn" :href="tjaBundleUrl">
      <ReworkIcon name="download" class="sa-ic" />{{ t("rework.songDetail.chart.download") }}
    </a>
  </div>
  <Teleport v-else to="#viewer-shell-dock" :disabled="!firefoxShell">
    <nav class="sa-dock":aria-label="t('rework.songDetail.chart.actions')">
      <NuxtLink v-if="tjaBundleUrl" class="rw-btn rw-btn--primary sa-main" :to="localePath(`/ourtaikoview/${songId}/${difficulty}`)" target="_blank" rel="noopener noreferrer">
        <ReworkIcon name="play" class="sa-ic" />{{ t("rework.songDetail.chart.practice") }}
      </NuxtLink>
      <a class="rw-btn sa-open" :class="{ 'is-only': !tjaBundleUrl }" :href="chartImageUrl(songId, difficulty, side)" target="_blank" rel="noopener noreferrer">{{ t("rework.songDetail.chart.open") }}</a>
      <a v-if="tjaBundleUrl" class="rw-btn sa-dl" :href="tjaBundleUrl" :aria-label="t('rework.songDetail.chart.download')" :title="t('rework.songDetail.chart.download')">
        <ReworkIcon name="download" class="sa-ic" />
      </a>
    </nav>
  </Teleport>
</template>

<style scoped>
.sa-head {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  width: 200px;
}
.sa-btn {
  width: 100%;
  font-weight: 700;
}
.sa-head .rw-btn--primary {
  min-height: 46px;
  font-size: var(--fs-16);
}
.sa-ic {
  flex: none;
  width: 18px;
  height: 18px;
}
.sa-dock {
  display: none;
}
@media (max-width: 767px) {
  .sa-head {
    display: none;
  }
  .sa-dock {
    position: fixed;
    left: 0;
    right: 0;
    /* above the shell's bottom navigation (same offset as the community reply box) */
    bottom: calc(65px + env(safe-area-inset-bottom, 0px));
    z-index: var(--z-bar);
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding: var(--sp-2) var(--sp-4);
    background: var(--surface);
    box-shadow: 0 -1px 0 var(--line);
  }
  .sa-dock .rw-btn {
    min-height: 48px;
    font-weight: 700;
  }
  .sa-main {
    flex: 1 1 auto;
    min-width: 0;
  }
  .sa-open {
    flex: 0 0 auto;
  }
  .sa-open.is-only {
    flex: 1 1 auto;
  }
  .sa-dl {
    flex: none;
    width: 48px;
    padding: 0;
  }
}
/* Soft keyboard open (html[data-kb], written by layouts/default.vue): the bottom navigation is hidden and the
   keyboard needs the room, so the bar steps aside. Plain root selector + class (compiles to html[data-kb] .sa-dock[…]). */
@media (max-width: 767px) {
  html[data-kb] .sa-dock {
    display: none;
  }
}
/* Firefox Android: inside #viewer-shell-dock the bar is a static flex child of the fixed shell. */
@media (max-width: 767px) {
  html.firefox-android #viewer-shell-dock > .sa-dock {
    position: static;
  }
}
</style>
