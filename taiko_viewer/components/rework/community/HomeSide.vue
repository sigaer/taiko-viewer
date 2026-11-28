<script setup lang="ts">
// ReworkCommunityHomeSide — the side column of /forum, all from existing payloads: charts with recent player notes
// (chart-activity), the home payload's highlighted tags (each searches all discussions) and its leaderboard
// (thread and like counts; there is no Rating or dan in the forum API).
import type { PropType } from "vue";
import type { ForumHomePayload } from "~/types/forum";
import type { CommunityChartActivity } from "~/types/ugc";

defineProps({
  activity: { type: Array as PropType<CommunityChartActivity[]>, default: () => [] },
  activityPending: { type: Boolean, default: false },
  tags: { type: Array as PropType<string[]>, default: () => [] },
  leaderboard: { type: Array as PropType<ForumHomePayload["leaderboard"]>, default: () => [] }
});
const { t } = useI18n();
const localePath = useLocalePath();
</script>

<template>
  <div class="chs">
    <ReworkPanel v-if="activityPending || activity.length" :title="t('community.chartActivity.title')" class="chs__panel community-chart-activity">
      <ReworkState v-if="activityPending" kind="loading" :lines="4" compact />
      <div v-else class="chs__activity">
        <ReworkCommunityChartActivity v-for="item in activity" :key="item.chartId" :item="item" />
      </div>
    </ReworkPanel>
    <ReworkPanel v-if="tags.length" :title="t('page.forum.index.tags')" class="chs__panel">
      <ul class="chs__tags">
        <li v-for="tag in tags" :key="tag">
          <NuxtLink class="chs__tag" :to="localePath({ path: '/forum/discussions', query: { keyword: tag } })">#{{ tag }}</NuxtLink>
        </li>
      </ul>
    </ReworkPanel>
    <ReworkPanel v-if="leaderboard.length" :title="t('page.forum.index.leaderboard')" class="chs__panel">
      <ol class="chs__top">
        <li v-for="(entry, index) in leaderboard" :key="entry.author.id">
          <span class="chs__pos num">{{ index + 1 }}</span>
          <ReworkCommunityAuthor :user="entry.author" :size="32" titles="none" class="chs__who" link />
          <span class="chs__counts">
            <span>{{ t("page.forum.index.postStat", { count: entry.threadCount }) }}</span>
            <span>{{ t("page.forum.index.likeStat", { count: entry.likeCount }) }}</span>
          </span>
        </li>
      </ol>
    </ReworkPanel>
  </div>
</template>

<style scoped>
.chs {
  display: grid;
  gap: var(--sp-5);
  min-width: 0;
  font-family: var(--font-ui);
}
.chs__panel :deep(.rw-panel__head) {
  margin-bottom: 0;
}
.chs__activity {
  display: grid;
}
.chs__tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.chs__tag {
  display: inline-flex;
  align-items: center;
  min-height: 36px;
  max-width: 100%;
  padding: 0 var(--sp-3);
  border: 1px solid var(--line-strong);
  border-radius: var(--r-note);
  color: var(--ink-2);
  font-size: var(--fs-13);
  text-decoration: none;
  overflow-wrap: anywhere;
}
.chs__tag:hover {
  background: var(--bg-sunk);
  color: var(--link);
}
.chs__tag:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.chs__top {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}
.chs__top li {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  min-height: var(--hit);
  padding: var(--sp-1) 0;
  border-bottom: 1px solid var(--line);
  min-width: 0;
}
.chs__top li:last-child {
  border-bottom: 0;
}
.chs__pos {
  flex: none;
  width: 18px;
  font-size: var(--fs-14);
  color: var(--ink-3);
  text-align: center;
}
.chs__who {
  flex: 1;
  min-width: 0;
}
.chs__counts {
  flex: none;
  display: grid;
  justify-items: end;
  font-size: var(--fs-11);
  color: var(--ink-3);
}
</style>
