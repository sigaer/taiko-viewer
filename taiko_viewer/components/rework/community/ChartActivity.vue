<script setup lang="ts">
// ReworkCommunityChartActivity — one chart with recent player notes (/api/content/community/chart-activity): cover,
// title, difficulty and stars, the difficulty summary, tags, the first tip, participants; links to item.href.
import type { PropType } from "vue";
import type { CommunityChartActivity } from "~/types/ugc";
import { activityTitle } from "~/utils/rework/community";

const props = defineProps({
  item: { type: Object as PropType<CommunityChartActivity>, required: true }
});
const { t, locale } = useI18n();
const localePath = useLocalePath();
const name = computed(() => activityTitle(props.item, locale.value));
const summary = computed(() => {
  switch (props.item.difficultySummary) {
    case "insufficient":
      return t("ugc.difficulty.summary.insufficient");
    case "mixed":
      return t("ugc.difficulty.summary.mixed");
    case "easy":
      return t("ugc.difficulty.summary.easy");
    case "balanced":
      return t("ugc.difficulty.summary.balanced");
    case "hard":
      return t("ugc.difficulty.summary.hard");
    default:
      return "";
  }
});
const tagLabel = (key: string) => t(key);
</script>

<template>
  <NuxtLink :to="localePath(item.href)" class="cact chart-activity-card">
    <DsCover :song-id="item.songId" size="md" />
    <span class="cact__body">
      <span class="cact__head">
        <b class="cact__title" :lang="name.lang">{{ name.text }}</b>
        <DsDiff :difficulty="item.difficulty" :star="item.level" :show-constant="false" />
      </span>
      <span v-if="summary || item.tags.length" class="cact__signals">
        <span v-if="summary" class="cact__sig is-summary">{{ summary }}</span>
        <span v-for="tag in item.tags" :key="tag.slug" class="cact__sig">#{{ tagLabel(tag.labelKey) }}</span>
      </span>
      <span v-if="item.tipPreview" class="cact__tip">{{ item.tipPreview.body }}</span>
      <span class="cact__foot">{{ t("community.chartActivity.participants", { count: item.participantCount }) }}</span>
    </span>
  </NuxtLink>
</template>

<style scoped>
.cact {
  display: flex;
  gap: var(--sp-3);
  padding: var(--sp-3) 0;
  border-bottom: 1px solid var(--line);
  color: var(--ink);
  text-decoration: none;
  font-family: var(--font-ui);
  min-width: 0;
}
.cact:last-child {
  border-bottom: 0;
}
.cact:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
  border-radius: var(--r-ctl);
}
.cact__body {
  display: grid;
  gap: 6px;
  min-width: 0;
  flex: 1;
}
.cact__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px var(--sp-2);
  min-width: 0;
}
.cact__title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--fs-14);
}
.cact:hover .cact__title {
  color: var(--link);
}
.cact__signals {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.cact__sig {
  display: inline-flex;
  align-items: center;
  height: var(--tag-h);
  padding: 0 6px;
  border-radius: var(--tag-radius);
  background: var(--tag-info-bg);
  color: var(--tag-info-ink);
  font-size: var(--fs-11);
}
.cact__sig.is-summary {
  background: var(--selected-bg);
  color: var(--selected-ink);
  font-weight: 700;
}
.cact__tip {
  font-size: var(--fs-13);
  line-height: var(--lh-body);
  color: var(--ink-2);
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.cact__foot {
  font-size: var(--fs-12);
  color: var(--ink-3);
}
</style>
