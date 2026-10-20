<script setup lang="ts">
import type { GrowthFact, RecentGrowthResponse } from "~/types/player-growth";
import { composeRecentGrowthCopy } from "~/utils/growthVoice";
import { difficultyLabelKey } from "~/utils/difficulty";
import { formatScoreRank } from "~/utils/scoreRank";

const props = defineProps<{ recent: RecentGrowthResponse; facts?: GrowthFact[]; suppressedCount?: number; pending?: boolean; failed?: boolean; appearance?: "home" }>();
const emit = defineEmits<{ presented: [token: string]; retry: [] }>();
const { t, locale } = useI18n();
const localePath = useLocalePath();
const narrative = computed(() => composeRecentGrowthCopy({ ...props.recent, facts: visibleFacts.value }));
const visibleFacts = computed(() => (props.facts || props.recent.facts).slice(0, 5));
const hiddenCount = computed(() => Math.max(0, props.recent.totalFacts - (props.suppressedCount || 0) - visibleFacts.value.length));
const shownElsewhere = computed(() => !visibleFacts.value.length && !hiddenCount.value && (props.suppressedCount || 0) > 0);
const observedLabel = computed(() => {
  const parsed = Date.parse(props.recent.observedAt || "");
  return Number.isFinite(parsed) ? new Intl.DateTimeFormat(locale.value === "ja" ? "ja-JP" : "zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Shanghai" }).format(parsed) : "";
});
const value = (fact: GrowthFact, raw: number | null | undefined) => fact.type === "rank-upgrade" ? formatScoreRank(raw ?? null, locale.value) : Number(raw || 0).toLocaleString(locale.value === "ja" ? "ja-JP" : "zh-CN");
const factText = (fact: GrowthFact) => {
  if (fact.type === "score-pb") return t("home.growth.recent.score", { value: value(fact, fact.after) });
  if (fact.type === "ng-reduced") return t("home.growth.recent.ngReduced", { value: value(fact, fact.after) });
  if (fact.type === "combo-improved") return t("home.growth.recent.combo", { value: value(fact, fact.after) });
  if (fact.type === "rank-upgrade") return t("home.growth.recent.rank", { value: value(fact, fact.after) });
  return t(`home.growth.recent.types.${fact.type}`);
};

watch(() => props.recent.boundary.currentToken, async token => {
  if (!import.meta.client || !token || !props.recent.boundary.acknowledgeRequired) return;
  await nextTick();
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  if (props.recent.boundary.currentToken === token && props.recent.boundary.acknowledgeRequired) emit("presented", token);
}, { immediate: true, flush: "post" });
</script>

<template>
  <section v-if="pending || failed || (recent.state !== 'unavailable' && !shownElsewhere)" class="recent-growth" :class="{ 'recent-growth--quiet': appearance === 'home' && !pending && !failed && !visibleFacts.length }" :aria-labelledby="appearance !== 'home' || pending || failed || visibleFacts.length ? 'recent-growth-title' : undefined" :aria-busy="pending || undefined">
    <div v-if="appearance !== 'home' || pending || failed || visibleFacts.length" class="recent-growth__head">
      <div>
        <h2 id="recent-growth-title">{{ t("home.growth.recent.title") }}</h2>
      </div>
      <time v-if="observedLabel" :datetime="recent.observedAt || undefined">{{ observedLabel }}</time>
    </div>
    <div v-if="pending" class="recent-growth__loading" aria-hidden="true">
      <span></span><span></span><span></span>
    </div>
    <div v-else-if="failed" class="recent-growth__state" role="alert">
      <span>{{ t("home.growth.recent.failed") }}</span>
      <button type="button" @click="emit('retry')">{{ t("home.growth.recent.retry") }}</button>
    </div>
    <div v-else-if="visibleFacts.length" class="recent-growth__list">
      <p v-if="recent.boundary.recovered" class="recent-growth__more">{{ t(narrative.key) }}</p>
      <NuxtLink
        v-for="fact in visibleFacts"
        :key="fact.factKey"
        :to="fact.songId ? localePath({ path: `/songs/${fact.songId}`, query: fact.difficultyType ? { difficulty: String(fact.difficultyType) } : undefined }) : localePath('/my/growth')"
        class="recent-growth__fact"
      >
        <span class="recent-growth__pulse" aria-hidden="true"></span>
        <span class="recent-growth__copy">
          <strong>{{ fact.title || t("home.growth.recent.goal") }}</strong>
          <small><template v-if="fact.difficultyType">{{ t(difficultyLabelKey(fact.difficultyType)) }} · </template>{{ factText(fact) }}</small>
        </span>
        <span class="recent-growth__arrow" aria-hidden="true">↗</span>
      </NuxtLink>
      <p v-if="hiddenCount" class="recent-growth__more">{{ t("home.growth.recent.more", { count: hiddenCount }) }}</p>
    </div>
    <p v-else class="recent-growth__empty">{{ t(narrative.key) }}</p>
  </section>
</template>

<style scoped>
.recent-growth.recent-growth--quiet { padding: 0; border: 0; border-radius: 0; background: transparent; }
.recent-growth--quiet::before { display: none; }
.recent-growth.recent-growth--quiet .recent-growth__empty { font-size: 14px; }

.recent-growth { position: relative; display: grid; gap: 16px; min-width: 0; padding: clamp(18px, 3vw, 26px); overflow: hidden; border: 1px solid var(--viewer-border); border-radius: 20px; background:var(--viewer-surface-subtle); }
.recent-growth::before { content: ""; position: absolute; inset: 0 auto 0 0; width: 4px; background:var(--viewer-primary); }
.recent-growth__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.recent-growth__eyebrow { margin: 0 0 4px; color:var(--viewer-link); font-size: 11px; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; }
.recent-growth h2 { margin: 0; color:var(--viewer-text); font: 800 clamp(20px, 2.4vw, 27px)/1.15 var(--viewer-display-font); }
.recent-growth time { flex: 0 0 auto; color:var(--viewer-text-muted); font-size: 12px; font-variant-numeric: tabular-nums; }
.recent-growth__list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }
.recent-growth__fact { min-width: 0; display: grid; grid-template-columns: 12px minmax(0, 1fr) auto; align-items: center; gap: 10px; min-height: 58px; padding: 10px 12px; border-radius: 13px; color:inherit; text-decoration: none; background:var(--viewer-surface-subtle); }
.recent-growth__fact { cursor: pointer; transition: background .18s ease, transform .18s ease; }
.recent-growth__fact:hover { transform: translateY(-1px); background:var(--viewer-surface); }
.recent-growth__fact:focus-visible, .recent-growth__state button:focus-visible { outline: 3px solid var(--viewer-link); outline-offset: 3px; }
.recent-growth__pulse { width: 9px; height: 9px; border: 2px solid #fff; border-radius: 50%; background:var(--viewer-primary); box-shadow:none; }
.recent-growth__copy { min-width: 0; display: grid; gap: 3px; }
.recent-growth__copy strong { overflow: hidden; color:var(--viewer-text); font-size: 14px; text-overflow: ellipsis; white-space: nowrap; }
.recent-growth__copy small, .recent-growth__empty, .recent-growth__more, .recent-growth__state { color:var(--viewer-text-muted); font-size: 12px; line-height: 1.5; }
.recent-growth__arrow { color:var(--viewer-primary); font-size: 17px; }
.recent-growth__more { grid-column: 1 / -1; margin: 2px 0 0 31px; }
.recent-growth__empty { margin: 0; }
.recent-growth__state { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.recent-growth__state button { min-width: 72px; min-height: 44px; padding: 8px 14px; border: 1px solid var(--viewer-border); border-radius: 10px; color:var(--viewer-link); background:transparent; cursor: pointer; font: inherit; font-weight: 700; }
.recent-growth__loading { display: grid; gap: 9px; }
.recent-growth__loading span { height: 52px; border-radius: 13px; background:var(--viewer-border); }
:global(body.theme-dark .recent-growth) { border-color:rgba(255,255,255,.12); background:var(--viewer-surface-subtle); }
:global(body.theme-dark .recent-growth h2), :global(body.theme-dark .recent-growth__copy strong) { color:var(--viewer-text); }
:global(body.theme-dark .recent-growth__fact) { background:var(--viewer-surface-subtle); }
:global(body.theme-dark .recent-growth__copy small), :global(body.theme-dark .recent-growth__empty), :global(body.theme-dark .recent-growth__more), :global(body.theme-dark .recent-growth__state), :global(body.theme-dark .recent-growth time) { color:var(--viewer-text-muted); }
@media (max-width: 680px) { .recent-growth__list { grid-template-columns: 1fr; } .recent-growth__head { align-items: end; } }
@media (prefers-reduced-motion: reduce) { .recent-growth__fact { transition: none; } .recent-growth__fact:hover { transform: none; } }
</style>
