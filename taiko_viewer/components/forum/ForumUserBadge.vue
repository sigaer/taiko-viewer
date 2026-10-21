<script setup lang="ts">
import type { ForumUserBadge } from "~/types/forum";

const props = defineProps<{
  user: ForumUserBadge;
  compact?: boolean;
  minimal?: boolean;
}>();

const { t } = useI18n();

const localizedRoleLabel = computed(() => t(`forum.roles.${props.user.role}`));
const localizedTaikoId = computed(() =>
  props.user.taikoIdMasked === "未绑定" ? t("forum.unboundTaikoId", "未绑定") : props.user.taikoIdMasked
);
</script>

<template>
  <div class="forum-user" :class="{ compact, minimal }">
    <ForumSafeImage
      class="forum-user__avatar"
      :src="user.avatarUrl"
      :alt="user.username"
    />
    <div class="forum-user__meta">
      <div class="forum-user__name-row">
        <strong>{{ user.username }}</strong>
        <span class="forum-user__role" :class="`role-${user.role}`">{{
          localizedRoleLabel
        }}</span>
      </div>
      <div v-if="!minimal" class="forum-user__detail">
        <span>{{ localizedTaikoId }}</span>
        <span v-if="user.verifiedTitle">{{ user.verifiedTitle }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.forum-user {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.forum-user.compact {
  gap: 8px;
}

.forum-user__avatar {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  object-fit: cover;
  border: 2px solid var(--viewer-border);
  box-shadow:0 10px 22px var(--viewer-shadow);
}

.forum-user.compact .forum-user__avatar {
  width: 38px;
  height: 38px;
  border-radius: 12px;
}

.forum-user__meta {
  min-width: 0;
  display: grid;
  gap: 3px;
}

.forum-user__name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.forum-user__name-row strong {
  min-width: 0;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.forum-user__role {
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 11px;
  line-height: 1.2;
  color:var(--viewer-on-primary);
}

.role-user {
  background:linear-gradient(135deg, var(--viewer-primary), var(--viewer-primary-hover));
}

.role-moderator {
  background:linear-gradient(135deg, var(--viewer-info), var(--viewer-info));
}

.role-admin {
  background:linear-gradient(135deg, var(--viewer-error), var(--viewer-error));
}

.forum-user__detail {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  color:var(--viewer-text-muted);
  font-size: 12px;
}

body.theme-dark .forum-user__detail {
  color:var(--viewer-text-muted);
}
</style>
