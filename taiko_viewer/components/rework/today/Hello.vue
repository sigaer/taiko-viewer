<script setup lang="ts">
// Header of the signed-in home: avatar beside the greeting <h1> (it carries the name, from the existing growth voice
// rules; the name is not repeated), site titles under it, the two growth pages on the same row from 768 px, below on phones.
// Slice G: when the home page provides it, the annual banner (AnnualHero, unchanged, 612 × 121) is part of this row:
// on the right of the greeting from 1100 px (the growth links then sit under the greeting), above it below 1100 px.
import type { Ref } from "vue";
import type { AccountTitle } from "~/types/account-title";

defineProps<{ greeting: string; name: string; avatarUrl?: string; titles?: AccountTitle[]; weeklyTo: string; passportTo: string }>();
const { t } = useI18n();
const banner = inject<Ref<boolean> | null>("rework-home-banner", null);
</script>

<template>
  <header class="th" :class="{ 'has-banner': banner }">
    <div v-if="banner" class="th-banner"><AnnualHero /></div>
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
.th-banner {
  grid-column: 1 / -1;
  width: 100%;
  max-width: 612px;
  margin-bottom: var(--sp-2);
}
@media (min-width: 1100px) {
  .th.has-banner {
    grid-template-columns: auto minmax(0, 1fr) minmax(0, 612px);
    grid-template-rows: auto auto;
    align-items: start;
  }
  .th.has-banner .th-banner {
    grid-column: 3;
    grid-row: 1 / span 2;
    align-self: center;
    margin: 0;
  }
  .th.has-banner .th-avatar {
    grid-row: 1;
  }
  .th.has-banner .th-links {
    grid-column: 2;
    grid-row: 2;
  }
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
