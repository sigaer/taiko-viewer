<script setup lang="ts">
// Changes since the last sync on the signed-in home. Logic unchanged (what is shown, the presentation acknowledgement
// after render); the markup is styled by components/rework/today/Board.vue. Crown facts show the crown with its name,
// rank facts the rank with its name.
import type { GrowthFact, RecentGrowthResponse } from "~/types/player-growth";
import { composeRecentGrowthCopy } from "~/utils/growthVoice";
import { difficultyLabelKey } from "~/utils/difficulty";
import { formatScoreRank } from "~/utils/scoreRank";
import { factCrown, rankValue } from "~/utils/rework/today";

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

let presentation = 0;
let frame: number | null = null;
let presentedToken = "";
let presentedProfile = "";
const active = ref(true);
onDeactivated(() => { active.value = false; presentation++; presentedToken = ""; if (frame !== null) cancelAnimationFrame(frame); });
onActivated(() => { active.value = true; });
onBeforeUnmount(() => { presentation++; if (frame !== null) cancelAnimationFrame(frame); });
watch(() => [props.recent.profileId, props.recent.boundary.currentToken, props.recent.boundary.acknowledgeRequired, props.pending, props.failed, active.value] as const, async ([profile, token, required, pending, failed, visible]) => {
  const request = ++presentation;
  if (frame !== null) { cancelAnimationFrame(frame); frame = null; }
  if (presentedProfile !== profile) { presentedProfile = profile; presentedToken = ""; }
  if (!import.meta.client || !visible || !profile || !token || !required || pending || failed || presentedToken === token || props.recent.state === 'unavailable') return;
  await nextTick();
  if (request !== presentation) return;
  frame = requestAnimationFrame(() => {
    frame = null;
    if (request === presentation && props.recent.profileId === profile && props.recent.boundary.currentToken === token && props.recent.boundary.acknowledgeRequired && !props.pending && !props.failed) {
      presentedToken = token;
      emit("presented", token);
    }
  });
}, { immediate: true, flush: "post" });
</script>

<template>
  <section v-if="pending || failed || (recent.state !== 'unavailable' && !shownElsewhere)" class="recent-growth" :class="{ 'recent-growth--quiet': appearance === 'home' && !pending && !failed && !visibleFacts.length }" :aria-labelledby="appearance !== 'home' || pending || failed || visibleFacts.length ? 'recent-growth-title' : undefined" :aria-busy="pending || undefined">
    <div v-if="appearance !== 'home' || pending || failed || visibleFacts.length" class="recent-growth__head">
      <h2 id="recent-growth-title">{{ t("home.growth.recent.title") }}</h2>
      <time v-if="observedLabel" :datetime="recent.observedAt || undefined">{{ observedLabel }}</time>
    </div>
    <div v-if="pending && !recent.profileId" class="recent-growth__loading" aria-hidden="true">
      <span></span><span></span><span></span>
    </div>
    <div v-else-if="failed" class="recent-growth__state" role="alert">
      <span>{{ t("home.growth.recent.failed") }}</span>
      <button type="button" class="rw-btn rw-btn--sm" @click="emit('retry')">{{ t("home.growth.recent.retry") }}</button>
    </div>
    <div v-if="visibleFacts.length" class="recent-growth__list">
      <p v-if="recent.boundary.recovered" class="recent-growth__more">{{ t(narrative.key) }}</p>
      <NuxtLink
        v-for="fact in visibleFacts"
        :key="fact.factKey"
        :to="fact.songId ? localePath({ path: `/songs/${fact.songId}`, query: fact.difficultyType ? { difficulty: String(fact.difficultyType) } : undefined }) : localePath('/my/growth')"
        class="recent-growth__fact"
      >
        <DsCover v-if="fact.songId" :song-id="fact.songId" size="sm" />
        <span v-else class="recent-growth__pulse" aria-hidden="true"></span>
        <span class="recent-growth__copy">
          <strong>{{ fact.title || t("home.growth.recent.goal") }}</strong>
          <small>
            <template v-if="fact.difficultyType">{{ t(difficultyLabelKey(fact.difficultyType)) }} · </template>
            <DsCrown v-if="factCrown(fact.type)" :state="factCrown(fact.type)!" size="chip" text="full" />
            <template v-else-if="fact.type === 'rank-upgrade' && rankValue(fact.after) !== null">{{ t("home.growth.factLabels.rank-upgrade") }} <DsRank :value="rankValue(fact.after)" named /></template>
            <template v-else>{{ factText(fact) }}</template>
          </small>
        </span>
      </NuxtLink>
      <p v-if="hiddenCount" class="recent-growth__more">{{ t("home.growth.recent.more", { count: hiddenCount }) }}</p>
    </div>
    <p v-else-if="(!pending || recent.profileId) && !failed" class="recent-growth__empty">{{ t(narrative.key) }}</p>
  </section>
</template>
