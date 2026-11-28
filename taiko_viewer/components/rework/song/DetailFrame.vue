<script setup lang="ts">
// Song detail layout (the way back is the shell bar's back button, which uses useLibraryReturn): loading skeleton,
// failed / missing states, then the header card, the difficulty tiles and the difficulty's tab panel:
//   ≥ 1100 px  two columns — main (chart excerpt, chart data) on the left; `side` (my score, or the sign-in card) and
//              `aside` (player notes, discussions) stacked on the right
//   < 1100 px  one column in reading order: side → main → aside
// `dock` is the phone action bar (ReworkSongActions variant "dock"); below 768 px the page keeps room for it.
import type { PropType } from "vue";

defineProps({
  state: { type: String as PropType<"loading" | "failed" | "missing" | "ready">, required: true },
  backHref: { type: String, required: true },
  panelId: { type: String, required: true },
  /** id of the tab that labels the panel */
  tabId: { type: String, required: true }
});
const emit = defineEmits<{ retry: [] }>();
const { t } = useI18n();
</script>

<template>
  <div class="sd" :class="{ 'has-dock': state === 'ready' && $slots.dock }">
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
      <div :id="panelId" class="sd-cols" role="tabpanel" :aria-labelledby="tabId">
        <div class="sd-side"><slot name="side" /></div>
        <div class="sd-main"><slot /></div>
        <div v-if="$slots.aside" class="sd-aside"><slot name="aside" /></div>
      </div>
      <slot name="dock" />
    </template>
  </div>
</template>

<style scoped>
.sd {
  display: grid;
  gap: var(--sp-5);
  min-width: 0;
  color: var(--ink);
  font-family: var(--font-ui);
}
.sd-diffbar {
  min-width: 0;
}
.sd-cols {
  display: grid;
  grid-template-columns: minmax(0, 1.9fr) minmax(320px, 1fr);
  grid-template-rows: auto 1fr;
  grid-template-areas:
    "main side"
    "main aside";
  gap: var(--sp-5);
  align-items: start;
  min-width: 0;
}
.sd-main,
.sd-side,
.sd-aside {
  display: grid;
  gap: var(--sp-5);
  min-width: 0;
}
.sd-main {
  grid-area: main;
}
.sd-side {
  grid-area: side;
}
.sd-aside {
  grid-area: aside;
  align-self: start;
}
.sd-state {
  border-top: 1px solid var(--line);
}
/* Loading skeleton keeps the header / tabs / block layout */
.sk-head {
  display: flex;
  gap: var(--sp-6);
  padding: var(--sp-6);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
}
.sk-cover {
  width: 148px;
  height: 148px;
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
  gap: var(--sp-3);
  margin-top: var(--sp-5);
}
.sk-tabs i {
  flex: 1 1 0;
  height: 72px;
  border-radius: var(--r-panel);
}
.sk-block {
  height: 320px;
  margin-top: var(--sp-5);
  border-radius: var(--r-panel);
  background: var(--bg-sunk);
}
@media (max-width: 1099px) {
  .sd-cols {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: none;
    grid-template-areas: "side" "main" "aside";
  }
}
@media (max-width: 767px) {
  .sd,
  .sd-cols,
  .sd-main,
  .sd-side,
  .sd-aside {
    gap: var(--sp-4);
  }
  /* room for the fixed action bar (48 px buttons + padding) under the last section */
  .sd.has-dock {
    padding-bottom: 72px;
  }
  /* Firefox Android: the bar is a flex child of the fixed shell under the scroll area, not over it */
  html.firefox-android .sd.has-dock {
    padding-bottom: 0;
  }
  .sk-head {
    padding: 0;
    border: 0;
  }
  .sk-cover {
    width: 96px;
    height: 96px;
  }
  .sk-tabs i {
    height: 68px;
  }
}
</style>
