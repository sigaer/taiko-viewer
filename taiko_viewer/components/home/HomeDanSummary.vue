<script setup lang="ts">
import { trackViewerEvent } from "~/utils/analytics";

const { t } = useI18n();
const localePath = useLocalePath();
</script>

<template>
  <section class="guest-dan panel-card" aria-labelledby="guest-dan-title">
    <div class="guest-dan__copy">
      <span>NIJIIRO 2026</span>
      <h2 id="guest-dan-title">{{ t("page.home.guest.danTitle") }}</h2>
      <p>{{ t("page.home.guest.danDescription") }}</p>
      <div class="guest-dan__actions">
        <NuxtLink
          :to="localePath('/grade/2026')"
          class="guest-dan__link"
          @click="trackViewerEvent('home_dan_click', { home_state: 'guest', source: 'dan_summary' })"
        >
          {{ t("page.home.guest.danCta") }}
        </NuxtLink>
        <NuxtLink
          to="/nijiiro_2026_dan_overview.png"
          external
          target="_blank"
          rel="noopener"
          class="guest-dan__overview-link"
          :aria-label="t('page.home.guest.danOverviewAria')"
          @click="trackViewerEvent('home_dan_overview_click', { home_state: 'guest', source: 'dan_summary' })"
        >
          {{ t("page.home.guest.danOverviewCta") }}
        </NuxtLink>
      </div>
    </div>
    <NuxtLink
      to="/nijiiro_2026_dan_overview.png"
      external
      target="_blank"
      rel="noopener"
      class="guest-dan__visual"
      :aria-label="t('page.home.guest.danOverviewAria')"
      @click="trackViewerEvent('home_dan_overview_click', { home_state: 'guest', source: 'dan_visual' })"
    >
      <img
        src="/optimized/nijiiro-2026-640.webp"
        :alt="t('page.home.guest.danImageAlt')"
        width="640"
        height="2287"
        loading="lazy"
        decoding="async"
      />
    </NuxtLink>
  </section>
</template>

<style scoped>
.guest-dan {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(260px, 0.85fr);
  align-items: center;
  min-height: 280px;
  overflow: hidden;
  background:var(--viewer-surface-subtle);
}

.guest-dan__copy {
  display: grid;
  gap: 10px;
  padding: clamp(24px, 4vw, 46px);
}

.guest-dan__copy > span {
  color:var(--viewer-link);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
}

.guest-dan h2 {
  margin: 0;
  color:var(--viewer-text);
  font-size: clamp(25px, 3.4vw, 38px);
  line-height: 1.15;
}

.guest-dan p {
  max-width: 540px;
  margin: 0;
  color:var(--viewer-text-muted);
  line-height: 1.7;
}

.guest-dan__link {
  width: fit-content;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  padding: 0 16px;
  border-radius: 12px;
  color:var(--viewer-on-primary);
  background:var(--viewer-primary);
  text-decoration: none;
  font-size: 13px;
  font-weight: 700;
}

.guest-dan__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
}

.guest-dan__overview-link {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  color:var(--viewer-link);
  text-underline-offset: 3px;
  font-size: 13px;
  font-weight: 700;
}

.guest-dan__visual {
  height: 280px;
  display: block;
  overflow: hidden;
  transform: rotate(3deg) translate(4%, 12%);
  border: 10px solid var(--viewer-border);
  border-radius: 22px 22px 0 0;
  background:var(--viewer-surface);
  box-shadow:none;
}

.guest-dan__visual img {
  width: 100%;
  height: auto;
  display: block;
}

.guest-dan__link:focus-visible,
.guest-dan__overview-link:focus-visible,
.guest-dan__visual:focus-visible {
  outline: 3px solid var(--viewer-link);
  outline-offset: 3px;
}

:global(body.theme-dark .guest-dan) {
  border-color:var(--viewer-border);
  background:var(--viewer-surface-subtle);
}

:global(body.theme-dark .guest-dan__visual) {
  border-color:var(--viewer-border);
  background:var(--viewer-surface);
}

:global(body.theme-dark .guest-dan__overview-link) {
  color:var(--viewer-link);
}

@media (max-width: 720px) {
  .guest-dan {
    grid-template-columns: minmax(0, 1fr) 116px;
    min-height: 220px;
  }

  .guest-dan__copy {
    padding: 22px 0 22px 20px;
  }

  .guest-dan p {
    font-size: 13px;
    line-height: 1.55;
  }

  .guest-dan__visual {
    height: 205px;
    transform: rotate(4deg) translate(14%, 16%);
    border-width: 7px;
  }
}
</style>
