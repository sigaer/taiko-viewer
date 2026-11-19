<script lang="ts">
// DsPlayerAvatar — player avatar (04 §7.8, 22 D3, D0-7 = A, P0-20).
// Uploaded image → round, object-fit: cover, 1px --line outer ring. No avatar → /default-avatar.svg as is.
// Load failure → the default avatar. The server's fixed placeholder URL (utils/ds/avatar.ts) counts as no avatar.
// SSR: the server-rendered <img> may fail before hydration, when no error listener exists yet; onMounted checks
// `complete && naturalWidth === 0` and switches to the default. No generated identicons, no dan colouring.
import { DS_DEFAULT_AVATAR_SRC, hasUserAvatar, resolveAvatarSrc } from "~/utils/ds/avatar";

export const DS_AVATAR_SIZES = Object.freeze([24, 32, 44, 72, 96] as const);
export type DsAvatarSize = (typeof DS_AVATAR_SIZES)[number];

/** The source to show: the user's avatar unless it failed, otherwise the default. */
export function avatarSrc(url: unknown, failed: boolean): string {
  return failed ? DS_DEFAULT_AVATAR_SRC : resolveAvatarSrc(url);
}

/** True when an <img> already finished without decoding an image (it failed before a listener existed). */
export const failedBeforeListener = (img: { complete: boolean; naturalWidth: number } | null | undefined) =>
  !!img && img.complete && img.naturalWidth === 0;

export { DS_DEFAULT_AVATAR_SRC, hasUserAvatar };
</script>

<script setup lang="ts">
import { computed, onMounted, ref, watch, type PropType } from "vue";

const props = defineProps({
  /** ForumUserBadge.avatarUrl (or null) */
  src: { type: String as PropType<string | null>, default: null },
  size: { type: Number as PropType<DsAvatarSize>, default: 32 },
  /** Accessible name; leave empty when the nickname is next to the avatar (the image is then decorative). */
  label: { type: String, default: "" }
});

const img = ref<HTMLImageElement | null>(null);
const failed = ref(false);
const current = computed(() => avatarSrc(props.src, failed.value));
const isDefault = computed(() => current.value === DS_DEFAULT_AVATAR_SRC);

watch(
  () => props.src,
  () => {
    failed.value = false;
  }
);

function onError() {
  if (!isDefault.value) failed.value = true;
}

onMounted(() => {
  if (!isDefault.value && failedBeforeListener(img.value)) failed.value = true;
});
</script>

<template>
  <span
    class="ds-avatar"
    :class="{ 'is-default': isDefault }"
    :style="{ width: `${size}px`, height: `${size}px` }"
    :role="label ? 'img' : undefined"
    :aria-label="label || undefined"
    :aria-hidden="label ? undefined : 'true'"
    :data-avatar="isDefault ? 'default' : 'user'"
  >
    <img ref="img" class="ds-avatar__img" :src="current" alt="" :width="size" :height="size" decoding="async" @error="onError" />
  </span>
</template>

<style scoped>
.ds-avatar {
  display: inline-block;
  flex: none;
  overflow: hidden;
  border-radius: 50%;
  background: var(--bg-sunk);
  vertical-align: middle;
}
/* 1px --line outer ring on uploaded images; the default avatar is shown as is */
.ds-avatar:not(.is-default) {
  box-shadow: 0 0 0 1px var(--line);
}
.ds-avatar__img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
