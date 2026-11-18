<script setup lang="ts">
// Header of the signed-in home: avatar beside the greeting <h1> (it carries the name, from the existing growth voice
// rules; the name is not repeated), site titles under it, the two growth pages on the same row from 768 px, below on phones.
import type { AccountTitle } from "~/types/account-title";

defineProps<{ greeting: string; name: string; avatarUrl?: string; titles?: AccountTitle[]; weeklyTo: string; passportTo: string }>();
const { t } = useI18n();
</script>

<template>
  <header class="th">
    <DsPlayerAvatar class="th-avatar" :src="avatarUrl || ''" :size="44" />
    <div class="th-body">
      <h1 id="growth-title" class="th-title">{{ greeting }}</h1>
      <AccountTitleBadges :titles="titles" />
    </div>
    <nav class="th-links" :aria-label="t('home.growth.storyLinks')">
      <NuxtLink :to="weeklyTo" class="rw-btn rw-btn--sm growth-weekly-link">{{ t("weekly.title") }}</NuxtLink>
      <NuxtLink :to="passportTo" class="rw-btn rw-btn--sm growth-weekly-link">{{ t("passport.title") }}</NuxtLink>
    </nav>
  </header>
</template>

<style scoped>
.th {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--sp-2) var(--sp-4);
  min-width: 0;
}
.th-body {
  display: grid;
  justify-items: start;
  gap: var(--sp-1);
  min-width: 0;
}
.th-links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}
.th-title {
  margin: 0;
  font-size: var(--fs-28);
  font-weight: 900;
  line-height: var(--lh-tight);
  overflow-wrap: anywhere;
}
@media (max-width: 767px) {
  .th {
    grid-template-columns: auto minmax(0, 1fr);
  }
  .th-links {
    grid-column: 1 / -1;
  }
  .th-title {
    font-size: var(--fs-22);
  }
}
</style>
