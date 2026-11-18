<script setup lang="ts">
// ReworkSyncNextSteps — "接下来" after a successful or partly successful sync / import (the page's showNextSteps):
// the status line and the same three links as before.
defineProps({ partial: { type: Boolean, default: false } });
const { t } = useI18n();
const localePath = useLocalePath();
</script>

<template>
  <section class="sync-next rs-next" aria-labelledby="sync-next-title">
    <h2 id="sync-next-title" class="rs-next__title">{{ t("accountSyncNext.title") }}</h2>
    <p class="rs-next__text" role="status">{{ t(partial ? "accountSyncNext.partial" : "accountSyncNext.success") }}</p>
    <nav class="rs-next__links" :aria-label="t('accountSyncNext.title')">
      <NuxtLink class="rw-btn" :to="localePath('/account/songs')">{{ t("account.songs") }}</NuxtLink>
      <NuxtLink class="rw-btn" :to="localePath('/my/growth')">{{ t("passport.title") }}</NuxtLink>
      <NuxtLink class="rw-btn" :to="localePath('/tools/recommend')">{{ t("accountSyncNext.recommend") }}</NuxtLink>
    </nav>
  </section>
</template>

<style scoped>
.rs-next {
  display: grid;
  gap: var(--sp-3);
  min-width: 0;
  padding: var(--sp-4) var(--sp-5);
  border: 1px solid var(--line);
  border-left: 3px solid var(--ok);
  border-radius: var(--r-panel);
  background: var(--surface);
  color: var(--ink);
  font-family: var(--font-ui);
  overflow-wrap: anywhere;
}
.rs-next__title {
  margin: 0;
  font-size: var(--fs-16);
  font-weight: 700;
}
.rs-next__text {
  margin: 0;
  font-size: var(--fs-14);
  line-height: var(--lh-body);
  color: var(--ink-2);
}
.rs-next__links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}
.rs-next__links .rw-btn {
  white-space: normal;
}
</style>
