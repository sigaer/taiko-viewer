<script setup lang="ts">
// Song detail layout (the way back is the shell bar's back button, which uses useLibraryReturn): loading skeleton, failed / missing states, then header, the sticky difficulty bar
// and two columns — main sections on the left and "my score" on the right from 1100 px (sticky); below 1100 px the
// score panel comes first. The columns are the difficulty tab panel (`panelId`, labelled by the selected tab).
import type { PropType } from "vue";

defineProps({
  state: { type: String as PropType<"loading" | "failed" | "missing" | "ready">, required: true },
  backHref: { type: String, required: true },
  panelId: { type: String, required: true },
  /** id of the tab that labels the panel */
  tabId: { type: String, required: true },
  /** false: the right column is not shown below 1100 px (a guest's prompt goes into the main column instead) */
  sideNarrow: { type: Boolean, default: true }
});
const emit = defineEmits<{ retry: [] }>();
const { t } = useI18n();
</script>

<template>
  <div class="sd">
    <div v-if="state === 'loading'" class="sd-loading" role="status" aria-busy="true">
      <span class="rw-vh">{{ t("rework.state.loading") }}</span>
      <div class="sk-head" aria-hidden="true"><span class="sk-cover" /><span class="sk-lines"><i /><i /><i class="short" /></span></div>
      <div class="sk-tabs" aria-hidden="true"><i v-for="n in 4" :key="n" /></div>
      <div class="sk-block" aria-hidden="true" />
    </div>
    <ReworkState v-else-if="state === 'failed'" kind="failed" class="sd-state" :title="t('rework.songDetail.failed')" @retry="emit('retry')">
      <NuxtLink class="rw-btn" :to="backHref">{{ t("rework.songDetail.backToList") }}</NuxtLink>
    </ReworkState>
    <ReworkState v-else-if="state === 'missing'" kind="empty" class="sd-state" :title="t('rework.songDetail.missing')">
      <NuxtLink class="rw-btn" :to="backHref">{{ t("rework.songDetail.backToList") }}</NuxtLink>
    </ReworkState>
    <template v-else>
      <slot name="head" />
      <div class="sd-diffbar"><slot name="tabs" /></div>
      <div :id="panelId" class="sd-cols" :class="{ 'is-side-wide-only': !sideNarrow }" role="tabpanel" :aria-labelledby="tabId">
        <aside class="sd-side" :class="{ 'is-wide-only': !sideNarrow }"><slot name="side" /></aside>
        <div class="sd-main"><slot /></div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.sd {
  min-width: 0;
  color: var(--ink);
  font-family: var(--font-ui);
}
.sd-diffbar {
  position: sticky;
  top: var(--bar-h);
  z-index: 5;
  margin: var(--sp-5) calc(var(--gutter) * -1) 0;
  padding: var(--sp-2) var(--gutter);
  background: var(--bg);
  border-bottom: 1px solid var(--line);
}
.sd-cols {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  grid-template-areas: "main side";
  gap: var(--sp-10);
  align-items: start;
  margin-top: var(--sp-5);
}
.sd-main {
  grid-area: main;
  display: grid;
  gap: var(--sp-10);
  min-width: 0;
}
.sd-side {
  grid-area: side;
  position: sticky;
  top: calc(var(--bar-h) + 76px);
  min-width: 0;
}
.sd-state {
  border-top: 1px solid var(--line);
}
/* Loading skeleton keeps the header / tabs / block layout */
.sk-head {
  display: flex;
  gap: var(--sp-6);
}
.sk-cover {
  width: 112px;
  height: 112px;
  flex: none;
  border-radius: var(--r-panel);
  background: var(--bg-sunk);
}
.sk-lines {
  flex: 1;
  display: grid;
  align-content: start;
  gap: var(--sp-3);
}
.sk-lines i,
.sk-tabs i {
  display: block;
  height: 16px;
  border-radius: var(--r-xs);
  background: var(--bg-sunk);
}
.sk-lines i:first-child {
  height: 28px;
  width: 70%;
}
.sk-lines i.short {
  width: 40%;
}
.sk-tabs {
  display: flex;
  gap: var(--sp-2);
  margin-top: var(--sp-6);
}
.sk-tabs i {
  width: 120px;
  height: var(--hit);
}
.sk-block {
  height: 320px;
  margin-top: var(--sp-6);
  border-radius: var(--r-panel);
  background: var(--bg-sunk);
}
@media (max-width: 1239px) {
  .sd-cols {
    grid-template-columns: minmax(0, 1fr) 300px;
    gap: var(--sp-8);
  }
}
@media (max-width: 1099px) {
  .sd-cols {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: "side" "main";
  }
  .sd-side {
    position: static;
  }
  .sd-side.is-wide-only {
    display: none;
  }
  .sd-cols.is-side-wide-only {
    grid-template-areas: "main";
  }
}
@media (max-width: 767px) {
  .sd-diffbar {
    top: var(--bar-h-m);
    margin: var(--sp-4) -16px 0;
    padding: var(--sp-2) 16px;
  }
  .sd-main {
    gap: var(--sp-8);
  }
  .sk-cover {
    width: 72px;
    height: 72px;
  }
  .sk-tabs i {
    width: 64px;
  }
}
</style>
