<script setup lang="ts">
import { trackViewerEvent } from "~/utils/analytics";

defineProps<{ accountStatusUnavailable?: boolean }>();

const { t } = useI18n();
const localePath = useLocalePath();
const features = ["B30", "Rating", t("tools.recommend"), t("tools.progress"), t("account.versionSummary")];
</script>

<template>
  <section class="guest-account-value panel-card" aria-labelledby="guest-account-title">
    <div class="guest-account-value__copy">
      <span>{{ t("nav.myTaiko") }}</span>
      <h2 id="guest-account-title">{{ t("page.home.guest.accountTitle") }}</h2>
      <p>{{ t("page.home.guest.accountDescription") }}</p>
      <div class="guest-account-value__features" :aria-label="t('page.home.guest.accountFeatures')">
        <span v-for="feature in features" :key="feature">{{ feature }}</span>
      </div>
      <NuxtLink
        :to="localePath('/account/login')"
        class="guest-account-value__cta"
        @click="trackViewerEvent('home_account_value_click', { home_state: accountStatusUnavailable ? 'error' : 'guest', source: 'conversion' })"
      >
        {{ t("page.home.guest.accountCta") }}
      </NuxtLink>
    </div>
    <div class="guest-account-value__visual" aria-hidden="true">
      <div class="guest-account-value__score">
        <small>MY TAIKO</small>
        <strong>12,840</strong>
        <span>RATING</span>
      </div>
      <div class="guest-account-value__bars">
        <i style="--bar: 82%"></i>
        <i style="--bar: 64%"></i>
        <i style="--bar: 92%"></i>
        <i style="--bar: 73%"></i>
      </div>
    </div>
  </section>
</template>

<style scoped>
.guest-account-value {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(240px, 0.75fr);
  align-items: center;
  gap: 24px;
  overflow: hidden;
  padding: clamp(24px, 4vw, 46px);
  background:var(--viewer-surface-subtle);
}

.guest-account-value__copy {
  display: grid;
  gap: 11px;
}

.guest-account-value__copy > span {
  color:#f4c990;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.guest-account-value h2 {
  margin: 0;
  color:#fff8ef;
  font-size: clamp(25px, 3.5vw, 40px);
  line-height: 1.15;
}

.guest-account-value p {
  max-width: 620px;
  margin: 0;
  color:#e7d5c7;
  line-height: 1.7;
}

.guest-account-value__features {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.guest-account-value__features span {
  padding: 6px 10px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 999px;
  color:#fff4e7;
  background:rgba(255, 255, 255, 0.07);
  font-size: 12px;
}

.guest-account-value__cta {
  width: fit-content;
  min-height: 46px;
  display: inline-flex;
  align-items: center;
  padding: 0 17px;
  border-radius: 13px;
  color:#5d3927;
  background:#f6d4a7;
  text-decoration: none;
  font-size: 13px;
  font-weight: 800;
}

.guest-account-value__cta:focus-visible {
  outline: 3px solid #fff;
  outline-offset: 3px;
}

.guest-account-value__visual {
  width: min(100%, 330px);
  min-height: 190px;
  display: grid;
  align-content: center;
  gap: 20px;
  justify-self: end;
  padding: 24px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 22px;
  background:rgba(255, 255, 255, 0.09);
  box-shadow:inset 0 1px 0 rgba(255, 255, 255, 0.14);
  transform: rotate(2deg);
}

.guest-account-value__score {
  display: grid;
  gap: 2px;
}

.guest-account-value__score small,
.guest-account-value__score span {
  color:#e8c49e;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.14em;
}

.guest-account-value__score strong {
  color:#fff8ef;
  font-size: 36px;
  line-height: 1;
}

.guest-account-value__bars {
  display: grid;
  gap: 7px;
}

.guest-account-value__bars i {
  width: var(--bar);
  height: 7px;
  display: block;
  border-radius: 999px;
  background:linear-gradient(90deg, #f3b66c, #f8dfba);
}

@media (max-width: 720px) {
  .guest-account-value {
    grid-template-columns: 1fr;
    padding: 24px 20px;
  }

  .guest-account-value__visual {
    display: none;
  }

  .guest-account-value p {
    font-size: 13px;
    line-height: 1.55;
  }
}
</style>
