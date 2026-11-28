<script setup lang="ts">
// ReworkCommunityPeople — a list of members from /api/forum/relationships (following, followers or blocked): identity
// (linking to the member's page), 互相关注 when the API says so, and one action per row that only emits — unfollow,
// follow back (followers not followed yet) or unblock. The page posts users/:id/follow or users/:id/block.
import type { PropType } from "vue";
import type { ForumRelationshipItem } from "~/types/forum";

defineProps({
  items: { type: Array as PropType<ForumRelationshipItem[]>, required: true },
  scope: { type: String as PropType<"following" | "followers" | "blocked">, required: true },
  busyId: { type: Number as PropType<number | null>, default: null }
});
const emit = defineEmits<{ follow: [userId: number, enabled: boolean]; unblock: [userId: number] }>();
const { t } = useI18n();
</script>

<template>
  <ul class="cpl">
    <li v-for="item in items" :key="item.user.id" class="cpl__row">
      <ReworkCommunityAuthor :user="item.user" :size="44" titles="text" link class="cpl__who" />
      <span v-if="item.mutualFollow" class="cpl__tag">{{ t("rework.forum.user.mutual") }}</span>
      <span class="cpl__act">
        <button v-if="scope === 'following'" type="button" class="rw-btn rw-btn--sm" :disabled="busyId !== null" :aria-busy="busyId === item.user.id || undefined" @click="emit('follow', item.user.id, false)">{{ t("rework.forum.user.unfollow") }}</button>
        <button v-else-if="scope === 'followers' && !item.mutualFollow" type="button" class="rw-btn rw-btn--sm rw-btn--primary" :disabled="busyId !== null" :aria-busy="busyId === item.user.id || undefined" @click="emit('follow', item.user.id, true)">{{ t("rework.forum.user.followBack") }}</button>
        <button v-else-if="scope === 'blocked'" type="button" class="rw-btn rw-btn--sm" :disabled="busyId !== null" :aria-busy="busyId === item.user.id || undefined" @click="emit('unblock', item.user.id)">{{ t("rework.forum.user.unblock") }}</button>
      </span>
    </li>
  </ul>
</template>

<style scoped>
.cpl {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
  font-family: var(--font-ui);
}
.cpl__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-2) var(--sp-3);
  min-height: 64px;
  padding: var(--sp-3) var(--sp-5);
  border-top: 1px solid var(--line);
}
.cpl__row:first-child {
  border-top: 0;
}
.cpl__who {
  flex: 1 1 200px;
  min-width: 0;
}
.cpl__tag {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 var(--sp-2);
  border-radius: var(--tag-radius);
  background: var(--info-wash);
  color: var(--info-ink);
  font-size: var(--fs-12);
  font-weight: 700;
}
.cpl__act {
  margin-left: auto;
}
@media (max-width: 767px) {
  .cpl__row {
    padding-inline: var(--sp-4);
  }
}
</style>
