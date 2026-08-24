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
      <NuxtLink
        :to="localePath('/grade/2026')"
        class="guest-dan__link"
        @click="trackViewerEvent('home_dan_click', { home_state: 'guest', source: 'dan_summary' })"
      >
        {{ t("page.home.guest.danCta") }}
      </NuxtLink>
    </div>
    <NuxtLink
      :to="localePath('/grade/2026')"
      class="guest-dan__visual"
      :aria-label="t('page.home.guest.danCta')"
      @click="trackViewerEvent('home_dan_click', { home_state: 'guest', source: 'dan_visual' })"
    >
      <img
        src="/optimized/nijiiro-2026-640.webp"
        :alt="t('page.home.guest.danImageAlt')"
        width="640"
        height="1831"
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
  background:
    linear-gradient(110deg, rgba(255, 252, 247, 0.98) 0 56%, rgba(247, 222, 193, 0.74)),
    var(--viewer-surface);
}

.guest-dan__copy {
  display: grid;
  gap: 10px;
  padding: clamp(24px, 4vw, 46px);
}

.guest-dan__copy > span {
  color: #a85f3e;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
}

.guest-dan h2 {
  margin: 0;
  color: var(--viewer-text);
  font-size: clamp(25px, 3.4vw, 38px);
  line-height: 1.15;
}

.guest-dan p {
  max-width: 540px;
  margin: 0;
  color: var(--viewer-text-muted);
  line-height: 1.7;
}

.guest-dan__link {
  width: fit-content;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  padding: 0 16px;
  border-radius: 12px;
  color: #fff;
  background: #a85f3e;
  text-decoration: none;
  font-size: 13px;
  font-weight: 700;
}

.guest-dan__visual {
  height: 280px;
  display: block;
  overflow: hidden;
  transform: rotate(3deg) translate(4%, 12%);
  border: 10px solid rgba(255, 255, 255, 0.7);
  border-radius: 22px 22px 0 0;
  background: #fff;
  box-shadow: 0 22px 44px rgba(102, 67, 42, 0.18);
}

.guest-dan__visual img {
  width: 100%;
  height: auto;
  display: block;
}

.guest-dan__link:focus-visible,
.guest-dan__visual:focus-visible {
  outline: 3px solid #a85f3e;
  outline-offset: 3px;
}

:global(body.theme-dark .guest-dan) {
  border-color: rgba(255, 255, 255, 0.1);
  background:
    linear-gradient(110deg, rgba(35, 29, 25, 0.98) 0 56%, rgba(80, 50, 34, 0.72)),
    var(--viewer-surface);
}

:global(body.theme-dark .guest-dan__visual) {
  border-color: rgba(255, 255, 255, 0.12);
  background: #241e1a;
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
