<script setup lang="ts">
// ReworkInfoMoreHub — /more, 全部功能 (redesign v2): the account card, the navigation model's groups as icon grids
// (曲库 / 我的成绩 / 工具), the account and support links, the language switch, the product name and version (`meta`
// slot, the page reads the version). Every entry comes from utils/rework/navigation.ts and is labelled with its page's
// title. `.more-hub` and `.mh-link` are kept for the self-check scenarios.
import type { PropType } from "vue";
import type { NavGroup, NavItem } from "~/utils/rework/navigation";

defineProps({
  groups: { type: Array as PropType<readonly NavGroup[]>, required: true },
  links: { type: Array as PropType<readonly NavItem[]>, required: true },
  user: { type: Object as PropType<{ username: string; avatarUrl?: string } | null>, default: null },
  signingOut: { type: Boolean, default: false },
  locales: { type: Array as PropType<{ code: string; label: string; path: string }[]>, required: true },
  currentLocale: { type: String, required: true }
});
const emit = defineEmits<{ signOut: [] }>();
const { t } = useI18n();
const localePath = useLocalePath();
</script>

<template>
  <div class="more-hub">
    <section class="mh-account" :aria-label="t('rework.accountMenu')">
      <template v-if="user">
        <NuxtLink :to="localePath('/account/profile')" class="mh-who">
          <DsPlayerAvatar :src="user.avatarUrl || ''" :size="52" />
          <span class="mh-who__body">
            <span class="mh-who__name">{{ user.username }}</span>
            <span class="mh-who__label">{{ t("account.profile") }}</span>
          </span>
          <ReworkIcon name="forward" class="mh-chev" />
        </NuxtLink>
        <NuxtLink :to="localePath('/account/sync')" class="mh-primary"><ReworkIcon name="sync" />{{ t("rework.shell.syncScores") }}</NuxtLink>
      </template>
      <NuxtLink v-else :to="localePath('/account')" class="mh-primary">{{ t("rework.login") }}</NuxtLink>
    </section>
    <section v-for="group in groups" :key="group.key" class="mh-group" :class="`is-${group.key}`" :aria-labelledby="`more-${group.key}`">
      <h2 :id="`more-${group.key}`" class="mh-title">{{ t(group.labelKey) }}</h2>
      <ul class="mh-grid">
        <li v-for="item in group.items" :key="item.to">
          <NuxtLink :to="localePath(item.to)" class="mh-tile">
            <span class="mh-tile__icon"><ReworkIcon :name="item.icon" /></span>
            <span class="mh-tile__label">{{ t(item.labelKey) }}</span>
          </NuxtLink>
        </li>
      </ul>
    </section>
    <section class="mh-group" aria-labelledby="more-account">
      <h2 id="more-account" class="mh-title">{{ t("rework.shell.accountSupport") }}</h2>
      <ul class="mh-links">
        <li v-for="item in links" :key="item.to">
          <NuxtLink :to="localePath(item.to)" class="mh-link">{{ t(item.labelKey) }}</NuxtLink>
        </li>
        <li v-if="user">
          <button type="button" class="mh-link" :disabled="signingOut" :aria-busy="signingOut" data-sign-out @click="emit('signOut')">
            {{ t("rework.account.profile.signOut") }}
          </button>
        </li>
      </ul>
    </section>
    <section class="mh-group" aria-labelledby="more-language">
      <h2 id="more-language" class="mh-title">{{ t("page.more.language") }}</h2>
      <div class="rw-seg mh-lang">
        <NuxtLink v-for="item in locales" :key="item.code" custom :to="item.path">
          <template #default="{ href, navigate }">
            <a :href="href" :hreflang="item.code" :aria-current="item.code === currentLocale ? 'true' : undefined" @click="navigate">{{ item.label }}</a>
          </template>
        </NuxtLink>
      </div>
    </section>
    <p class="mh-meta"><slot name="meta" /></p>
  </div>
</template>

<style scoped>
.more-hub {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  min-width: 0;
  font-family: var(--font-ui);
  color: var(--ink);
}
.mh-account {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-3) var(--sp-4);
  padding: var(--sp-4);
  border-radius: var(--r-sheet);
  background: var(--side-bg);
  color: var(--side-ink-strong);
}
.mh-who {
  flex: 1 1 240px;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  min-height: var(--hit);
  color: var(--side-ink-strong);
  text-decoration: none;
  border-radius: var(--r-ctl);
}
.mh-who__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}
.mh-who__name {
  font-size: var(--fs-18);
  font-weight: 800;
  overflow-wrap: anywhere;
}
.mh-who__label {
  font-size: var(--fs-13);
  color: var(--side-ink);
}
.mh-who:hover .mh-who__name {
  text-decoration: underline;
}
.mh-who .mh-chev {
  color: var(--side-ink);
}
.mh-primary {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  min-height: var(--ctl-h-lg);
  padding: 0 var(--btn-pad-x-lg);
  border-radius: var(--r-ctl);
  background: var(--action-bg);
  color: var(--action-ink);
  font-size: var(--fs-14);
  font-weight: 800;
  text-decoration: none;
}
.mh-primary:hover {
  background: var(--action-bg-hover);
}
.mh-primary:active {
  background: var(--action-bg-active);
}
.mh-primary svg {
  width: 18px;
  height: 18px;
}
.mh-group {
  min-width: 0;
  padding: var(--sp-4) var(--sp-3) var(--sp-3);
  border: 1px solid var(--line);
  border-radius: var(--r-sheet);
  background: var(--surface);
}
.mh-title {
  margin: 0 0 var(--sp-3);
  padding: 0 var(--sp-2);
  font-size: var(--fs-16);
  font-weight: 800;
}
.mh-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  gap: var(--sp-3) var(--sp-1);
  margin: 0;
  padding: 0;
  list-style: none;
}
.mh-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-height: var(--hit);
  padding: var(--sp-1) 2px;
  color: var(--ink);
  text-decoration: none;
  border-radius: var(--r-panel);
}
.mh-tile__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 16px;
  background: var(--info-wash);
  color: var(--info-ink);
}
.is-scores .mh-tile__icon {
  background: var(--brand-soft);
  color: var(--brand-ink);
}
.is-tools .mh-tile__icon {
  background: var(--bg-sunk);
  color: var(--ink);
}
.mh-tile__icon svg {
  width: 24px;
  height: 24px;
}
.mh-tile__label {
  max-width: 100%;
  font-size: var(--fs-12);
  font-weight: 600;
  line-height: 1.3;
  text-align: center;
  overflow-wrap: anywhere;
}
.mh-tile:hover .mh-tile__label {
  color: var(--link);
}
.mh-links {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--sp-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.mh-link {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 46px;
  padding: 0 var(--sp-4);
  box-sizing: border-box;
  border: 0;
  border-radius: var(--r-ctl);
  background: var(--bg-sunk);
  color: var(--ink);
  font: inherit;
  font-size: var(--fs-14);
  font-weight: 600;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
}
.mh-link:hover {
  color: var(--link);
}
.mh-link:disabled {
  color: var(--disabled-ink);
  cursor: default;
}
.more-hub :is(a, button):focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.mh-chev {
  width: 18px;
  height: 18px;
  flex: none;
  color: var(--ink-3);
}
.mh-lang a {
  display: inline-flex;
  align-items: center;
  min-height: var(--hit);
  padding: 0 var(--sp-4);
  border-radius: calc(var(--r-ctl) - 2px);
  color: var(--ink-2);
  font-size: var(--fs-14);
  text-decoration: none;
}
.mh-lang a[aria-current] {
  background: var(--seg-on-bg);
  color: var(--seg-on-ink);
  font-weight: 700;
  box-shadow: 0 0 0 1px var(--seg-on-ring);
}
.mh-meta {
  margin: 0;
  font-size: var(--fs-12);
  color: var(--ink-3);
  text-align: center;
}
@media (max-width: 767px) {
  .mh-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--sp-3) var(--sp-1);
  }
  .mh-links {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .mh-primary {
    flex: 1 1 auto;
  }
}
</style>
