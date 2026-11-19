<script setup lang="ts">
// What signing in gives (was components/home/HomeAccountValue.vue): title, description, the feature names and the
// sign-in link; analytics event unchanged. The decorative Rating card of the old block is not carried over
// (a number no API returned).
import { trackViewerEvent } from "~/utils/analytics";

defineProps<{ accountStatusUnavailable?: boolean }>();
const { t } = useI18n();
const localePath = useLocalePath();
const features = computed(() => ["B30", "Rating", t("tools.recommend"), t("tools.progress"), t("account.versionSummary")]);
</script>

<template>
  <section class="ta guest-account-value" aria-labelledby="guest-account-title">
    <div class="ta-copy">
      <span class="ta-eyebrow">{{ t("nav.myTaiko") }}</span>
      <h2 id="guest-account-title" class="ta-title">{{ t("page.home.guest.accountTitle") }}</h2>
      <p class="ta-text">{{ t("page.home.guest.accountDescription") }}</p>
      <ul class="ta-features" :aria-label="t('page.home.guest.accountFeatures')">
        <li v-for="feature in features" :key="feature">{{ feature }}</li>
      </ul>
    </div>
    <NuxtLink
      :to="localePath('/account/login')"
      class="rw-btn rw-btn--primary ta-cta"
      @click="trackViewerEvent('home_account_value_click', { home_state: accountStatusUnavailable ? 'error' : 'guest', source: 'conversion' })"
    >{{ t("page.home.guest.accountCta") }}</NuxtLink>
  </section>
</template>

<style scoped>
.ta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--sp-4) var(--sp-8);
  padding: var(--sp-5) var(--sp-6);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface-2);
  color: var(--ink);
  font-family: var(--font-ui);
}
.ta-copy {
  display: grid;
  gap: var(--sp-2);
  flex: 1 1 420px;
  min-width: 0;
}
.ta-eyebrow {
  color: var(--ink-3);
  font-size: var(--fs-12);
  font-weight: 600;
}
.ta-title {
  margin: 0;
  font-size: var(--fs-22);
  font-weight: 800;
  line-height: var(--lh-tight);
}
.ta-text {
  margin: 0;
  max-width: 40em;
  color: var(--ink-2);
  font-size: var(--fs-14);
  line-height: var(--lh-body);
}
.ta-features {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  margin: var(--sp-1) 0 0;
  padding: 0;
  list-style: none;
}
.ta-features li {
  padding: 3px 10px;
  border: 1px solid var(--line);
  border-radius: var(--tag-radius);
  background: var(--surface);
  color: var(--ink-2);
  font-size: var(--fs-12);
}
.ta-cta {
  flex: none;
}
@media (max-width: 767px) {
  .ta {
    padding: var(--sp-4);
  }
  .ta-title {
    font-size: var(--fs-18);
  }
  .ta-cta {
    flex: 1 1 100%;
  }
}
</style>
