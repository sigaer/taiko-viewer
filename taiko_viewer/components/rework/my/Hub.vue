<script setup lang="ts">
// "My Taiko" hub (pages/my/index.vue renders it; the page keeps the session check and the entry list).
// Identity band (signed in) or the sign-in prompt (guest), then the entry groups as lists, then the annual entry.
// Loading and a failed session check keep the groups visible below them, as before.
// The groups keep the old `my-links` class: the Linux My Taiko integration tests look for it in the server HTML.
import type { PropType } from "vue";
import type { AccountTitle } from "~/types/account-title";

type Entry = { path: string; label: string; icon: string };
defineProps({
  status: { type: String as PropType<"loading" | "error" | "guest" | "authenticated" | string>, required: true },
  user: {
    type: Object as PropType<{ id: number; username: string; avatarUrl?: string; titles?: AccountTitle[] } | null>,
    default: null
  },
  groups: { type: Array as PropType<{ key: string; items: Entry[] }[]>, required: true },
  annual: { type: Object as PropType<{ path: string; label: string } | null>, default: null }
});
const emit = defineEmits<{ retry: [] }>();
const { t } = useI18n();
const localePath = useLocalePath();
</script>

<template>
  <div class="hub">
    <h1 class="rw-vh">{{ t("nav.myTaiko") }}</h1>
    <ReworkState v-if="status === 'loading'" kind="loading" :lines="2" class="hub-state" />
    <ReworkState v-else-if="status === 'error'" kind="failed" :title="t('page.myTaiko.authFailed')" class="hub-state" @retry="emit('retry')" />
    <ReworkGate v-else-if="status === 'guest'" class="hub-gate" need="login" :title="t('page.myTaiko.guestTitle')" />
    <NuxtLink v-else :to="localePath('/account/profile')" class="who">
      <DsPlayerAvatar :key="`${user?.id}:${user?.avatarUrl}`" :src="user?.avatarUrl || ''" :size="72" />
      <span class="who-body">
        <span class="who-name">{{ user?.username }}</span>
        <AccountTitleBadges :titles="user?.titles" />
        <span class="who-label">{{ t("account.profile") }}</span>
      </span>
      <svg class="go" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
    </NuxtLink>

    <div class="groups">
      <nav v-for="group in groups" :key="group.key" class="group my-links" :aria-labelledby="`my-group-${group.key}`">
        <h2 :id="`my-group-${group.key}`" class="group-title">{{ group.key === 'common' ? t('page.myTaiko.groups.common') : t('page.myTaiko.groups.data') }}</h2>
        <ul class="list">
          <li v-for="item in group.items" :key="item.path">
            <NuxtLink :to="localePath(item.path)">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="item.icon" /></svg>
              <span class="grow">{{ t(item.label) }}</span>
              <svg class="go" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
            </NuxtLink>
          </li>
        </ul>
      </nav>
    </div>
    <ul v-if="annual" class="list annual">
      <li>
        <NuxtLink :to="localePath(annual.path)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v17H5z M8 2v4m8-4v4 M8 10h8m-8 4h5" /></svg>
          <span class="grow">{{ t(annual.label) }}</span>
          <svg class="go" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.hub {
  display: grid;
  gap: var(--sp-6);
  max-width: 980px;
  min-width: 0;
  font-family: var(--font-ui);
  color: var(--ink);
}
.hub svg {
  width: 22px;
  height: 22px;
  flex: none;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.hub-state,
.hub-gate {
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
}
.who {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  min-height: var(--hit);
  padding: var(--sp-2);
  margin: calc(var(--sp-2) * -1);
  border-radius: var(--r-panel);
  color: var(--ink);
  text-decoration: none;
}
.who:hover .who-name {
  color: var(--link);
}
.who-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  min-width: 0;
}
.who-name {
  font-size: var(--fs-22);
  font-weight: 800;
  line-height: var(--lh-tight);
  overflow-wrap: anywhere;
}
.who-label {
  font-size: var(--fs-13);
  color: var(--ink-3);
}
.go {
  color: var(--ink-3);
}
.groups {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--sp-5) var(--sp-6);
}
.group {
  min-width: 0;
}
.group-title {
  margin: 0 0 6px 4px;
  font-size: var(--fs-13);
  font-weight: 500;
  color: var(--ink-3);
}
.list {
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
  overflow: hidden;
}
.list li + li {
  border-top: 1px solid var(--line);
}
.list a {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 52px;
  padding: 0 14px 0 16px;
  color: var(--ink);
  font-size: var(--fs-16);
  font-weight: 500;
  text-decoration: none;
}
.list a > svg:first-child {
  color: var(--ink-2);
}
.list a:hover {
  background: var(--surface-2);
}
.grow {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
:is(.who, .list a):focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: -2px;
}
@media (max-width: 767px) {
  .hub {
    gap: var(--sp-5);
  }
  .groups {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--sp-4);
  }
  .who-name {
    font-size: var(--fs-18);
  }
}
</style>
