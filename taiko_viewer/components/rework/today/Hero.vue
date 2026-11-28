<script setup lang="ts">
// Rating card of the signed-in home (redesign 2026-11-27): a vermilion card with the overall Rating as its numeral
// (/api/account/growth/overview playerState.overallRating, on its 15.5 scale; "—" while it is loading, failed or
// missing). From 768 px it links the B30 table and the Rating trend; on phones it carries the sync action instead
// (those two pages are in the 常用 grid below it). No change figure, sparkline or last-sync time: the overview does not
// return them. Labels and addresses come from the navigation model.
import { ACCOUNT_LINKS, SCORES_TABS } from "~/utils/rework/navigation";

const props = defineProps<{ rating: number | null }>();
const { t } = useI18n();
const localePath = useLocalePath();
const tab = (key: string) => SCORES_TABS.find((item) => item.key === key)!;
const b30 = tab("b30");
const trend = tab("trend");
const sync = ACCOUNT_LINKS.find((item) => item.key === "sync")!;
const value = computed(() => (props.rating === null || !Number.isFinite(props.rating) ? "—" : props.rating.toFixed(2)));
</script>

<template>
  <section class="thr" aria-label="Rating">
    <span class="thr-k" aria-hidden="true">RATING</span>
    <p class="thr-v">
      <span class="rw-display thr-num">{{ value }}</span>
      <span class="thr-scale">/ 15.5</span>
    </p>
    <div class="thr-actions">
      <NuxtLink class="thr-btn thr-btn--fill thr-wide" :to="localePath(b30.to)">{{ t(b30.labelKey) }}</NuxtLink>
      <NuxtLink class="thr-btn thr-wide" :to="localePath(trend.to)">{{ t(trend.labelKey) }}</NuxtLink>
      <NuxtLink class="thr-btn thr-btn--fill thr-phone" :to="localePath(sync.to)"><ReworkIcon name="sync" />{{ t("rework.shell.syncScores") }}</NuxtLink>
    </div>
  </section>
</template>

<style scoped>
.thr {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
  min-width: 0;
  box-sizing: border-box;
  padding: 22px var(--sp-6) var(--sp-5);
  border-radius: var(--r-panel);
  background: var(--action-bg);
  color: var(--action-ink);
  font-family: var(--font-ui);
}
.thr-k {
  font-size: var(--fs-13);
  font-weight: 700;
  letter-spacing: 0.12em;
}
.thr-v {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0 var(--sp-2);
  margin: 0;
}
.thr-num {
  font-size: clamp(3.25rem, 2rem + 3vw, 4.25rem);
  line-height: 1;
}
.thr-scale {
  font-family: var(--font-display);
  font-size: var(--fs-16);
  font-weight: 700;
}
.thr-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  margin-top: auto;
  padding-top: var(--sp-4);
}
.thr-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  min-height: var(--hit);
  padding: 0 var(--sp-4);
  border: 1.5px solid var(--action-ink);
  border-radius: var(--r-ctl);
  color: var(--action-ink);
  font-size: var(--fs-14);
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
}
.thr-btn--fill {
  background: var(--action-ink);
  color: var(--action-bg-active);
}
.thr-btn:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}
.thr-btn:focus-visible {
  outline: 2px solid var(--action-ink);
  outline-offset: 2px;
}
.thr-btn :deep(svg) {
  width: 18px;
  height: 18px;
}
.thr-phone {
  display: none;
}
@media (max-width: 767px) {
  .thr {
    padding: var(--sp-5);
  }
  .thr-wide {
    display: none;
  }
  .thr-phone {
    display: inline-flex;
    min-height: 46px;
    font-size: var(--fs-16);
  }
}
</style>
