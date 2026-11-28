<script setup lang="ts">
// ReworkCommunityAuthor — a forum identity: DsPlayerAvatar, username, role tag (moderator / admin), the verified game
// title (DsTitlePlate: the plate image only when the API's plate id is in the asset map, the text form otherwise) and
// the site titles (DsSiteTitle). Only what the forum API returns for the user; never a dan badge (RK-46).
//   size     avatar size (24 / 32 / 44 / 72)
//   titles   "none" | "text" (one line, narrow places) | "plate" (wide places: the game title as a plate)
//   detail   also the masked Taiko ID (my community)
//   op       the thread author's tag (楼主) next to the name
// The default slot follows the name line (time, floor number).
import type { PropType } from "vue";
import type { ForumUserBadge } from "~/types/forum";
import { roleTag } from "~/utils/rework/community";
import { FORUM_UNBOUND_TAIKO_ID } from "~/utils/forum";

const props = defineProps({
  user: { type: Object as PropType<ForumUserBadge>, required: true },
  size: { type: Number as PropType<24 | 32 | 44 | 72>, default: 32 },
  titles: { type: String as PropType<"none" | "text" | "plate">, default: "text" },
  detail: { type: Boolean, default: false },
  op: { type: Boolean, default: false },
  /** heading level for the name (my community uses the name as the page <h1>) */
  as: { type: String, default: "span" },
  /** the name links to the member's page (/forum/user/:id) */
  link: { type: Boolean, default: false }
});
const { t } = useI18n();
const localePath = useLocalePath();
const userPath = computed(() => localePath(`/forum/user/${props.user.id}`));
const role = computed(() => roleTag(props.user));
const roleText = computed(() => (role.value === "admin" ? t("forum.roles.admin") : role.value === "moderator" ? t("forum.roles.moderator") : ""));
const taikoId = computed(() => (props.user.taikoIdMasked === FORUM_UNBOUND_TAIKO_ID ? t("forum.unboundTaikoId") : props.user.taikoIdMasked));
const hasTitles = computed(() => props.titles !== "none" && (Boolean(props.user.verifiedTitle) || Boolean(props.user.titles?.length)));
</script>

<template>
  <span class="ca" :class="[`ca--${size}`, { 'ca--plate': titles === 'plate' }]">
    <DsPlayerAvatar :src="user.avatarUrl" :size="size" />
    <span class="ca__text">
      <span class="ca__line">
        <NuxtLink v-if="link && user.id > 0" :to="userPath" class="ca__name ca__link" :title="user.username">{{ user.username }}</NuxtLink>
        <component :is="as" v-else class="ca__name" :title="user.username">{{ user.username }}</component>
        <span v-if="role" class="ca__role" :class="`is-${role}`">{{ roleText }}</span>
        <span v-if="op" class="ca__op">{{ t("rework.forum.op") }}</span>
        <slot />
      </span>
      <span v-if="hasTitles" class="ca__titles">
        <DsTitlePlate v-if="user.verifiedTitle" :name="user.verifiedTitle" :plate="user.verifiedTitleplateId" :form="titles === 'plate' ? 'plate' : 'text'" />
        <DsSiteTitle v-for="title in user.titles || []" :key="title.key" :name="title.name" />
      </span>
      <span v-if="detail && user.taikoIdMasked" class="ca__id num">{{ taikoId }}</span>
    </span>
  </span>
</template>

<style scoped>
.ca {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  min-width: 0;
  max-width: 100%;
  font-family: var(--font-ui);
  color: var(--ink);
}
.ca--44,
.ca--72 {
  gap: var(--sp-3);
}
.ca--72 {
  gap: var(--sp-4);
}
.ca__text {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.ca__line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px var(--sp-2);
  min-width: 0;
}
.ca__name {
  margin: 0;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--fs-13);
  font-weight: 700;
  line-height: var(--lh-snug);
}
.ca__link {
  color: inherit;
  text-decoration: none;
  border-radius: var(--r-xs);
}
.ca__link:hover {
  color: var(--link);
}
.ca__link:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.ca--44 .ca__name {
  font-size: var(--fs-14);
}
.ca--72 .ca__name {
  font-size: var(--fs-22);
  font-weight: 800;
  white-space: normal;
  overflow-wrap: anywhere;
}
.ca__role,
.ca__op {
  display: inline-flex;
  align-items: center;
  flex: none;
  height: var(--tag-h);
  padding: 0 6px;
  border-radius: var(--tag-radius);
  font-size: var(--fs-11);
  font-weight: 700;
  line-height: 1;
}
.ca__role.is-moderator {
  background: var(--role-mod-bg);
  color: var(--role-mod-ink);
}
.ca__role.is-admin {
  background: var(--role-admin-bg);
  color: var(--role-admin-ink);
}
.ca__op {
  background: var(--tag-info-bg);
  color: var(--tag-info-ink);
  font-weight: 500;
}
.ca__titles {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-1) var(--sp-2);
  min-width: 0;
  max-width: 100%;
}
.ca__id {
  font-size: var(--fs-12);
  color: var(--ink-3);
}
</style>
