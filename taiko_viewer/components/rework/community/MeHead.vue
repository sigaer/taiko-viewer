<script setup lang="ts">
// ReworkCommunityMeHead — the head of /forum/me: the page <h1>, the forum identity of the signed-in user (avatar,
// name, role, titles from /api/forum/home currentUser), the bound Taiko ID (/api/account/profile), thread and unread
// counts, and the two actions. Each figure appears only once its read has returned; read failures go in the slot.
import type { PropType } from "vue";
import type { ForumUserBadge } from "~/types/forum";

defineProps({
  title: { type: String, required: true },
  user: { type: Object as PropType<ForumUserBadge | null>, default: null },
  /** null while the profile read has not returned */
  taikoId: { type: String as PropType<string | null>, default: null },
  threadCount: { type: Number as PropType<number | null>, default: null },
  unread: { type: Number as PropType<number | null>, default: null }
});
const { t } = useI18n();
const localePath = useLocalePath();
</script>

<template>
  <header class="cmh me-profile-panel">
    <div class="cmh__top">
      <h1 class="cmh__h">{{ title }}</h1>
      <div class="cmh__actions">
        <NuxtLink :to="localePath('/forum/new')" class="rw-btn rw-btn--primary"><ReworkIcon name="edit" />{{ t("rework.forum.me.newThread") }}</NuxtLink>
        <NuxtLink :to="localePath('/forum/notifications')" class="rw-btn"><ReworkIcon name="bell" />{{ t("rework.forum.me.notifications") }}</NuxtLink>
      </div>
    </div>
    <div class="cmh__who">
      <ReworkCommunityAuthor v-if="user" :user="user" :size="72" titles="plate" />
      <dl class="cmh__facts">
        <div v-if="taikoId !== null">
          <dt>{{ t("rework.forum.me.bound") }}</dt>
          <dd class="num">{{ taikoId || t("rework.forum.me.unbound") }}</dd>
        </div>
        <div v-if="threadCount !== null">
          <dt>{{ t("rework.forum.me.threadCount") }}</dt>
          <dd class="num">{{ threadCount }}</dd>
        </div>
        <div v-if="unread !== null">
          <dt>{{ t("rework.forum.me.unread") }}</dt>
          <dd class="num">{{ unread }}</dd>
        </div>
      </dl>
    </div>
    <slot />
  </header>
</template>

<style scoped>
.cmh {
  display: grid;
  gap: var(--sp-4);
  font-family: var(--font-ui);
  color: var(--ink);
}
.cmh__top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3) var(--sp-4);
}
.cmh__h {
  margin: 0;
  font-size: clamp(1.375rem, 2.4vw, 2rem);
  font-weight: 800;
  line-height: var(--lh-tight);
}
.cmh__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}
.cmh__actions :deep(svg) {
  width: 18px;
  height: 18px;
}
.cmh__who {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-4) var(--sp-6);
  padding: var(--sp-5);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
  min-width: 0;
}
.cmh__facts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-3) var(--sp-6);
  margin: 0;
}
.cmh__facts div {
  display: grid;
  gap: 2px;
}
.cmh__facts dt {
  font-size: var(--fs-12);
  color: var(--ink-3);
}
.cmh__facts dd {
  margin: 0;
  font-size: var(--fs-22);
  color: var(--emph-num);
  overflow-wrap: anywhere;
}
@media (max-width: 767px) {
  .cmh__actions {
    width: 100%;
  }
  .cmh__actions .rw-btn {
    flex: 1 1 0;
  }
  .cmh__who {
    padding: var(--sp-4);
  }
}
</style>
