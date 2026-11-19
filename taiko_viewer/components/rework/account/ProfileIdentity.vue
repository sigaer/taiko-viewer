<script setup lang="ts">
// ReworkAccountProfileIdentity — the header of /account/profile: avatar (DsPlayerAvatar; /default-avatar.svg when
// there is none), the username as the page's <h1>, site titles (DsSiteTitle), the current game title (DsTitlePlate),
// the current bound ID and the sign-up time. The avatar controls stay in the page (`avatar-actions` slot: the upload
// keeps its component ref there); `extra` takes the annual entry.
import type { PropType } from "vue";
import type { ProfilePayload } from "~/utils/rework/account";
import { PROFILE_SECTIONS } from "~/utils/rework/account";

const props = defineProps({
  profile: { type: Object as PropType<ProfilePayload>, required: true }
});
const { t } = useI18n();
const { formatDateTime } = useViewerDateTime();
const current = computed(() => props.profile.currentBinding);
// The plate image is known only for the title recorded at verification; a later title is shown as text.
const plate = computed(() =>
  current.value && current.value.currentTitle && current.value.currentTitle === current.value.verifiedTitle ? current.value.verifiedTitleplateId : null
);
</script>

<template>
  <header :id="PROFILE_SECTIONS.identity" class="ra-ident" :aria-labelledby="`${PROFILE_SECTIONS.identity}-title`">
    <div class="ra-ident__avatar">
      <DsPlayerAvatar :src="profile.user.avatarUrl" :size="72" />
      <div class="ra-ident__avatar-actions"><slot name="avatar-actions" /></div>
    </div>
    <div class="ra-ident__main">
      <h1 :id="`${PROFILE_SECTIONS.identity}-title`" class="ra-ident__name" tabindex="-1" data-section-heading>{{ profile.user.username }}</h1>
      <p v-if="profile.user.titles?.length || current?.currentTitle" class="ra-ident__titles">
        <template v-if="current?.currentTitle">
          <span class="ra-ident__plate is-wide"><DsTitlePlate :name="current.currentTitle" :plate="plate" form="plate" /></span>
          <span class="ra-ident__plate is-narrow"><DsTitlePlate :name="current.currentTitle" :plate="plate" form="text" /></span>
        </template>
        <DsSiteTitle v-for="title in profile.user.titles || []" :key="title.key" :name="title.name" :data-title-key="title.key" />
      </p>
      <dl class="ra-ident__facts">
        <div>
          <dt>{{ t("rework.account.profile.currentBinding") }}</dt>
          <dd :class="{ num: current?.taikoId }">{{ current?.taikoId || current?.displayName || t("rework.account.profile.unbound") }}</dd>
        </div>
        <div>
          <dt>{{ t("rework.account.profile.createdAt") }}</dt>
          <dd>{{ profile.user.createdAt ? formatDateTime(profile.user.createdAt) : "—" }}</dd>
        </div>
      </dl>
      <slot name="extra" />
    </div>
  </header>
</template>

<style scoped>
.ra-ident {
  display: flex;
  align-items: flex-start;
  gap: var(--sp-5);
  padding-bottom: var(--sp-6);
  border-bottom: 1px solid var(--line-strong);
  scroll-margin-top: calc(var(--bar-h) + var(--sp-6));
}
.ra-ident__avatar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-2);
  flex: none;
  width: 112px;
}
.ra-ident__avatar-actions {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--sp-1);
  width: 100%;
}
.ra-ident__main {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  flex: 1;
  min-width: 0;
}
.ra-ident__name {
  margin: 0;
  font-size: clamp(1.375rem, 2.4vw, 1.75rem);
  font-weight: 800;
  line-height: var(--lh-tight);
  overflow-wrap: anywhere;
}
.ra-ident__name:focus {
  outline: none;
}
.ra-ident__name:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 3px;
  border-radius: var(--r-xs);
}
.ra-ident__titles {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px var(--sp-2);
  margin: 0;
}
.ra-ident__facts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2) var(--sp-6);
  margin: 0;
  font-size: var(--fs-14);
}
.ra-ident__facts div {
  display: flex;
  flex-wrap: wrap;
  gap: 2px var(--sp-2);
  min-width: 0;
}
.ra-ident__facts dt {
  color: var(--ink-2);
}
.ra-ident__facts dd {
  margin: 0;
  color: var(--ink);
  overflow-wrap: anywhere;
}
.ra-ident__plate {
  display: inline-flex;
  min-width: 0;
  max-width: 100%;
}
.ra-ident__plate.is-narrow {
  display: none;
}
@media (max-width: 767px) {
  .ra-ident {
    gap: var(--sp-4);
  }
  .ra-ident__plate.is-wide {
    display: none;
  }
  .ra-ident__plate.is-narrow {
    display: inline-flex;
  }
  .ra-ident__avatar {
    width: 96px;
  }
}
</style>
