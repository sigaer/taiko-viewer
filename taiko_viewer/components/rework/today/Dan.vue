<script setup lang="ts">
// 虹 2026 段位道场 summary of the home page (was components/home/HomeDanSummary.vue). Static content: the grade page,
// the full overview image (new window) and its preview. Links, image attributes and analytics events unchanged.
import { trackViewerEvent } from "~/utils/analytics";

const { t } = useI18n();
const localePath = useLocalePath();
</script>

<template>
  <section class="td guest-dan" aria-labelledby="guest-dan-title">
    <div class="td-copy">
      <span class="td-eyebrow num">NIJIIRO 2026</span>
      <h2 id="guest-dan-title" class="td-title">{{ t("page.home.guest.danTitle") }}</h2>
      <p class="td-text">{{ t("page.home.guest.danDescription") }}</p>
      <div class="td-actions">
        <NuxtLink
          :to="localePath('/grade/2026')"
          class="rw-btn rw-btn--primary"
          @click="trackViewerEvent('home_dan_click', { home_state: 'guest', source: 'dan_summary' })"
        >{{ t("page.home.guest.danCta") }}</NuxtLink>
        <NuxtLink
          to="/nijiiro_2026_dan_overview.png"
          external
          target="_blank"
          rel="noopener"
          class="rw-btn rw-btn--ghost"
          :aria-label="t('page.home.guest.danOverviewAria')"
          @click="trackViewerEvent('home_dan_overview_click', { home_state: 'guest', source: 'dan_summary' })"
        >{{ t("page.home.guest.danOverviewCta") }}<ReworkIcon name="open" class="td-open" /></NuxtLink>
      </div>
    </div>
    <NuxtLink
      to="/nijiiro_2026_dan_overview.png"
      external
      target="_blank"
      rel="noopener"
      class="td-visual"
      :aria-label="t('page.home.guest.danOverviewAria')"
      @click="trackViewerEvent('home_dan_overview_click', { home_state: 'guest', source: 'dan_visual' })"
    >
      <img src="/optimized/nijiiro-2026-640.webp" :alt="t('page.home.guest.danImageAlt')" width="640" height="2287" loading="lazy" decoding="async" />
    </NuxtLink>
  </section>
</template>

<style scoped>
.td {
  display: grid;
  grid-template-columns: minmax(0, 1fr) clamp(112px, 34%, 200px);
  align-items: stretch;
  overflow: hidden;
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
  color: var(--ink);
  font-family: var(--font-ui);
}
.td-copy {
  display: grid;
  align-content: center;
  gap: var(--sp-2);
  padding: var(--sp-5);
  min-width: 0;
}
.td-eyebrow {
  color: var(--ink-3);
  font-size: var(--fs-12);
  letter-spacing: 0.08em;
}
.td-title {
  margin: 0;
  font-size: var(--fs-22);
  font-weight: 800;
  line-height: var(--lh-tight);
}
.td-text {
  margin: 0;
  color: var(--ink-2);
  font-size: var(--fs-14);
}
.td-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  margin-top: var(--sp-2);
}
.td-open {
  width: 16px;
  height: 16px;
}
.td-visual {
  display: block;
  height: 220px;
  overflow: hidden;
  border-left: 1px solid var(--line);
  background: var(--bg-sunk);
}
.td-visual img {
  display: block;
  width: 100%;
  height: auto;
}
.td-visual:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: -2px;
}
@media (max-width: 767px) {
  .td {
    grid-template-columns: minmax(0, 1fr) 112px;
  }
  .td-copy {
    padding: var(--sp-4);
  }
  .td-title {
    font-size: var(--fs-18);
  }
  .td-visual {
    height: 180px;
  }
}
</style>
