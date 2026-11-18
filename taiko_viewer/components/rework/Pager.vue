<script setup lang="ts">
import { pagerItems } from "~/utils/rework/catalog";
// Numbered pages from 820 px up; previous / next with "x / y" below that. Every page is a real link
// (NuxtLink custom: RouterLink would mark every /songs?… link as the current page).
const props = defineProps<{ page: number; count: number; href: (page: number) => string }>();
const { t } = useI18n();
const items = computed(() => pagerItems(props.page, props.count));
</script>
<template>
  <nav class="pager" :aria-label="t('rework.library.pager')">
    <NuxtLink v-if="page > 1" v-slot="{ href: to, navigate }" :to="href(page - 1)" custom
      ><a class="pg-step" :href="to" rel="prev" :aria-label="t('rework.library.prev')" @click="navigate"
        ><ReworkIcon name="back" /><span class="pg-step-text">{{ t("rework.library.prev") }}</span></a
      ></NuxtLink
    ><span v-else class="pg-step is-off" aria-hidden="true"><ReworkIcon name="back" /><span class="pg-step-text">{{ t("rework.library.prev") }}</span></span>
    <ol class="pg-pages">
      <li v-for="(item, index) in items" :key="item === 'gap' ? `gap-${index}` : item">
        <span v-if="item === 'gap'" class="pg-gap" aria-hidden="true">…</span>
        <NuxtLink v-else v-slot="{ href: to, navigate }" :to="href(item)" custom>
          <a
            class="pg-num"
            :href="to"
            :aria-label="t('rework.library.pageN', { n: item })"
            :aria-current="item === page ? 'page' : undefined"
            @click="navigate"
            >{{ item }}</a
          >
        </NuxtLink>
      </li>
    </ol>
    <span class="pg-compact">{{ page }} / {{ count }}</span>
    <NuxtLink v-if="page < count" v-slot="{ href: to, navigate }" :to="href(page + 1)" custom
      ><a class="pg-step pg-next" :href="to" rel="next" :aria-label="t('rework.library.next')" @click="navigate"
        ><span class="pg-step-text">{{ t("rework.library.next") }}</span><ReworkIcon name="back" class="pg-flip" /></a
      ></NuxtLink
    ><span v-else class="pg-step pg-next is-off" aria-hidden="true"><span class="pg-step-text">{{ t("rework.library.next") }}</span><ReworkIcon name="back" class="pg-flip" /></span>
  </nav>
</template>
<style scoped>
.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  margin-top: var(--sp-6);
  font-family: var(--font-ui);
}
.pg-pages {
  display: none;
  align-items: center;
  gap: var(--sp-1);
  margin: 0;
  padding: 0;
  list-style: none;
}
.pg-step,
.pg-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-1);
  min-width: var(--hit);
  min-height: var(--hit);
  padding: 0 var(--sp-3);
  border-radius: var(--r-ctl);
  color: var(--link);
  font-size: var(--fs-14);
  text-decoration: none;
}
.pg-num {
  padding: 0 var(--sp-2);
  color: var(--ink-2);
  font-family: var(--font-num);
  font-size: var(--fs-16);
}
.pg-step:not(.is-off):hover,
.pg-num:hover {
  background: var(--bg-sunk);
}
.pg-num[aria-current="page"] {
  background: var(--selected-bg);
  color: var(--selected-ink);
  font-weight: 700;
}
.pg-step.is-off {
  color: var(--ink-3);
  visibility: hidden;
}
.pg-gap {
  display: inline-grid;
  place-items: center;
  min-width: 28px;
  color: var(--ink-3);
}
.pg-compact {
  min-width: 72px;
  text-align: center;
  font-family: var(--font-num);
  font-size: var(--fs-16);
  color: var(--ink-2);
}
.pg-flip {
  transform: scaleX(-1);
}
.pg-step:focus-visible,
.pg-num:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
@media (min-width: 820px) {
  .pg-pages {
    display: flex;
  }
  .pg-compact {
    display: none;
  }
}
</style>
