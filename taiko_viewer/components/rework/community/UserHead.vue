<script setup lang="ts">
// ReworkCommunityUserHead — the head of a member's page (/forum/user/:id): the name as the page <h1> with avatar,
// role and titles, the relationship the API reports (follows you / mutual / blocked), the three counts, and the
// actions: follow / unfollow and block / unblock when signed in (only emits), a sign-in link when not, and a link to
// my community on one's own page.
import type { PropType } from "vue";
import type { ForumUserProfile } from "~/types/forum";

const props = defineProps({
  profile: { type: Object as PropType<ForumUserProfile>, required: true },
  signedIn: { type: Boolean, default: false },
  loginTo: { type: [String, Object] as PropType<string | Record<string, unknown>>, required: true },
  busy: { type: Boolean, default: false }
});
const emit = defineEmits<{ follow: []; block: [] }>();
const { t } = useI18n();
const localePath = useLocalePath();
const rel = computed(() => props.profile.relationship);
const tag = computed(() =>
  rel.value.isBlocked ? t("rework.forum.user.blockedNote") : rel.value.isFollowing && rel.value.isFollowedBy ? t("rework.forum.user.mutual") : rel.value.isFollowedBy ? t("rework.forum.user.followsYou") : ""
);
</script>

<template>
  <header class="cuh">
    <div class="cuh__who">
      <ReworkCommunityAuthor :user="profile.user" :size="72" titles="plate" as="h1" />
      <span v-if="tag" class="cuh__tag" :class="{ 'is-blocked': rel.isBlocked }">{{ tag }}</span>
    </div>
    <dl class="cuh__facts">
      <div>
        <dt>{{ t("rework.forum.user.threads") }}</dt>
        <dd class="num">{{ profile.stats.threadCount }}</dd>
      </div>
      <div>
        <dt>{{ t("rework.forum.user.followers") }}</dt>
        <dd class="num">{{ profile.stats.followerCount }}</dd>
      </div>
      <div>
        <dt>{{ t("rework.forum.user.followingCount") }}</dt>
        <dd class="num">{{ profile.stats.followingCount }}</dd>
      </div>
    </dl>
    <div class="cuh__actions">
      <NuxtLink v-if="rel.isSelf" :to="localePath('/forum/me')" class="rw-btn">{{ t("forum.myCommunity") }}</NuxtLink>
      <NuxtLink v-else-if="!signedIn" :to="loginTo" class="rw-btn rw-btn--primary">{{ t("rework.forum.user.login") }}</NuxtLink>
      <template v-else>
        <button
          v-if="!rel.isBlocked && !rel.isBlockedBy"
          type="button"
          class="rw-btn"
          :class="{ 'rw-btn--primary': !rel.isFollowing }"
          :aria-pressed="rel.isFollowing"
          :disabled="busy"
          :aria-busy="busy || undefined"
          @click="emit('follow')"
        >
          {{ rel.isFollowing ? t("rework.forum.user.unfollow") : rel.isFollowedBy ? t("rework.forum.user.followBack") : t("rework.forum.user.follow") }}
        </button>
        <button type="button" class="rw-btn rw-btn--danger" :disabled="busy" @click="emit('block')">
          {{ rel.isBlocked ? t("rework.forum.user.unblock") : t("rework.forum.user.block") }}
        </button>
      </template>
    </div>
  </header>
</template>

<style scoped>
.cuh {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas: "who actions" "facts facts";
  align-items: center;
  gap: var(--sp-4) var(--sp-6);
  padding: var(--sp-6);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
  font-family: var(--font-ui);
  color: var(--ink);
}
.cuh__who {
  grid-area: who;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-3);
  min-width: 0;
}
.cuh__tag {
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
.cuh__tag.is-blocked {
  background: var(--danger-wash);
  color: var(--danger);
}
.cuh__facts {
  grid-area: facts;
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-3) var(--sp-8);
  margin: 0;
  padding-top: var(--sp-4);
  border-top: 1px solid var(--line);
}
.cuh__facts div {
  display: grid;
  gap: 2px;
}
.cuh__facts dt {
  font-size: var(--fs-12);
  color: var(--ink-3);
}
.cuh__facts dd {
  margin: 0;
  font-size: var(--fs-22);
  font-weight: 800;
  color: var(--emph-num);
}
.cuh__actions {
  grid-area: actions;
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  justify-content: flex-end;
}
@media (max-width: 767px) {
  .cuh {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: "who" "actions" "facts";
    padding: var(--sp-4);
  }
  .cuh__actions {
    justify-content: stretch;
  }
  .cuh__actions > * {
    flex: 1 1 0;
  }
}
</style>
