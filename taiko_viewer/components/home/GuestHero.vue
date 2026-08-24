<script setup lang="ts">
import { trackViewerEvent } from "~/utils/analytics";

defineProps<{ accountStatusUnavailable?: boolean }>();

const { t } = useI18n();
const localePath = useLocalePath();
</script>

<template>
  <section class="guest-hero panel-card" aria-labelledby="guest-home-title">
    <div class="guest-hero__drum" aria-hidden="true">
      <span></span>
      <span></span>
      <span></span>
    </div>
    <div class="guest-hero__content">
      <p class="guest-hero__brand">Sakura Taiko Viewer</p>
      <h2 id="guest-home-title">{{ t("page.home.guest.heroTitle") }}</h2>
      <p class="guest-hero__lead">{{ t("page.home.guest.heroDescription") }}</p>
      <HomeGuestSongSearch />
      <div class="guest-hero__actions">
        <NuxtLink
          :to="localePath('/account/login')"
          class="guest-hero__cta guest-hero__cta--primary"
          @click="trackViewerEvent('home_account_value_click', { home_state: accountStatusUnavailable ? 'error' : 'guest', source: 'hero' })"
        >
          {{ t("page.home.guest.accountCta") }}
        </NuxtLink>
        <NuxtLink
          :to="localePath('/songs/available')"
          class="guest-hero__cta guest-hero__cta--secondary"
          @click="trackViewerEvent('home_browse_songs_click', { home_state: accountStatusUnavailable ? 'error' : 'guest', source: 'hero' })"
        >
          {{ t("page.home.guest.browseSongs") }}
        </NuxtLink>
      </div>
      <p class="guest-hero__scope">{{ t("page.home.guest.scope") }}</p>
    </div>
  </section>
</template>

<style scoped>
.guest-hero {
  position: relative;
  min-height: 390px;
  display: grid;
  align-items: center;
  overflow: hidden;
  padding: clamp(28px, 5vw, 64px);
  border-radius: 28px;
  background:
    radial-gradient(circle at 84% 20%, rgba(221, 126, 80, 0.2), transparent 26%),
    linear-gradient(135deg, rgba(255, 253, 249, 0.98), rgba(250, 237, 222, 0.94));
}

.guest-hero::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: radial-gradient(rgba(123, 83, 52, 0.12) 0.7px, transparent 0.7px);
  background-size: 12px 12px;
  mask-image: linear-gradient(90deg, transparent 5%, #000 65%);
}

.guest-hero__content {
  position: relative;
  z-index: 2;
  width: min(820px, 100%);
  display: grid;
  gap: 14px;
}

.guest-hero__brand {
  margin: 0;
  color: #a85f3e;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.guest-hero h2 {
  max-width: 760px;
  margin: 0;
  color: #3d2c22;
  font-size: clamp(34px, 5vw, 58px);
  line-height: 1.08;
  letter-spacing: -0.035em;
  text-wrap: balance;
}

.guest-hero__lead {
  max-width: 650px;
  margin: 0 0 4px;
  color: #6e5a4a;
  font-size: clamp(15px, 1.7vw, 18px);
  line-height: 1.65;
}

.guest-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.guest-hero__cta {
  min-height: 46px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 18px;
  border-radius: 13px;
  text-decoration: none;
  font-size: 14px;
  font-weight: 750;
  transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}

.guest-hero__cta--primary {
  color: #fff;
  background: #a85f3e;
  box-shadow: 0 12px 24px rgba(168, 95, 62, 0.22);
}

.guest-hero__cta--secondary {
  border: 1px solid rgba(134, 94, 64, 0.28);
  color: #6d4d38;
  background: rgba(255, 255, 255, 0.62);
}

.guest-hero__cta:hover {
  transform: translateY(-1px);
}

.guest-hero__cta:focus-visible {
  outline: 3px solid #a85f3e;
  outline-offset: 3px;
}

.guest-hero__scope {
  margin: 0;
  color: #8a7768;
  font-size: 12px;
  line-height: 1.5;
}

.guest-hero__drum {
  position: absolute;
  z-index: 1;
  right: clamp(-82px, -4vw, -34px);
  top: 50%;
  width: clamp(230px, 32vw, 420px);
  aspect-ratio: 1;
  transform: translateY(-50%) rotate(-8deg);
  border: clamp(10px, 1.2vw, 18px) solid rgba(168, 95, 62, 0.09);
  border-radius: 50%;
  box-shadow: inset 0 0 0 clamp(6px, 0.8vw, 12px) rgba(255, 255, 255, 0.48);
}

.guest-hero__drum::before,
.guest-hero__drum::after,
.guest-hero__drum span {
  content: "";
  position: absolute;
  border-radius: 50%;
}

.guest-hero__drum::before {
  inset: 15%;
  border: 2px solid rgba(168, 95, 62, 0.12);
}

.guest-hero__drum::after {
  inset: 40%;
  background: rgba(221, 126, 80, 0.1);
}

.guest-hero__drum span {
  width: 14%;
  aspect-ratio: 1;
  background: rgba(168, 95, 62, 0.12);
}

.guest-hero__drum span:nth-child(1) { top: 9%; left: 43%; }
.guest-hero__drum span:nth-child(2) { right: 14%; bottom: 24%; }
.guest-hero__drum span:nth-child(3) { left: 16%; bottom: 19%; }

:global(body.theme-dark .guest-hero) {
  border-color: rgba(255, 255, 255, 0.1);
  background:
    radial-gradient(circle at 84% 20%, rgba(202, 111, 70, 0.16), transparent 28%),
    linear-gradient(135deg, rgba(35, 29, 25, 0.98), rgba(28, 23, 20, 0.98));
}

:global(body.theme-dark .guest-hero h2) {
  color: #f7eee6;
}

:global(body.theme-dark .guest-hero__brand) {
  color: #df946f;
}

:global(body.theme-dark .guest-hero__lead) {
  color: #d1c1b5;
}

:global(body.theme-dark .guest-hero__scope) {
  color: #b8a89b;
}

:global(body.theme-dark .guest-hero__cta--secondary) {
  border-color: rgba(255, 255, 255, 0.18);
  color: #f0dfd0;
  background: rgba(255, 255, 255, 0.06);
}

:global(body.theme-dark .guest-hero__drum) {
  border-color: rgba(223, 148, 111, 0.13);
  box-shadow: inset 0 0 0 clamp(6px, 0.8vw, 12px) rgba(255, 255, 255, 0.04);
}

:global(body.theme-dark .guest-hero__drum::before) {
  border-color: rgba(223, 148, 111, 0.18);
}

:global(body.theme-dark .guest-hero__drum::after),
:global(body.theme-dark .guest-hero__drum span) {
  background: rgba(223, 148, 111, 0.14);
}

@media (max-width: 720px) {
  .guest-hero {
    min-height: 338px;
    align-items: start;
    padding: 22px 18px;
    border-radius: 22px;
  }

  .guest-hero__content {
    gap: 10px;
  }

  .guest-hero__brand {
    font-size: 11px;
  }

  .guest-hero h2 {
    max-width: 92%;
    font-size: clamp(27px, 8.5vw, 36px);
  }

  .guest-hero__lead {
    max-width: 92%;
    font-size: 14px;
    line-height: 1.5;
  }

  .guest-hero__actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .guest-hero__cta {
    min-height: 44px;
    padding: 0 10px;
    font-size: 13px;
  }

  .guest-hero__scope {
    display: none;
  }

  .guest-hero__drum {
    top: 22%;
    right: -82px;
    width: 210px;
    opacity: 0.72;
  }
}

@media (max-width: 390px) {
  .guest-hero {
    min-height: 326px;
    padding-inline: 14px;
  }

  .guest-hero__actions {
    gap: 8px;
  }
}

@media (max-width: 960px) and (max-height: 500px) and (orientation: landscape) {
  .guest-hero {
    min-height: 300px;
    padding: 20px 24px;
  }

  .guest-hero__content {
    gap: 8px;
  }

  .guest-hero h2 {
    max-width: 78%;
    font-size: clamp(28px, 5vw, 36px);
  }

  .guest-hero__lead {
    max-width: 72%;
    font-size: 14px;
    line-height: 1.45;
  }

  .guest-hero__scope {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .guest-hero__cta {
    transition: none;
  }
}
</style>
