<script setup lang="ts">
// ReworkCommunityThreadRow — one thread in a list (/forum, sections, all discussions, my community, the song page's
// related discussions). Shows only what the list API returns: section, type, states, title, summary, tags, author
// identity, last activity, counts, the media thumbnail and the related chart (DsCover + DsDiff).
// The whole row opens the thread (click / Enter, as before); links inside it (section, title, chart) keep their own
// targets.
//   compact  no summary, tags or media (the song page and narrow side lists)
import type { PropType } from "vue";
import type { ForumThreadCard } from "~/types/forum";
import { resolveForumSectionTranslation } from "~/utils/forum";
import { threadSongLocation, threadSongTitle, threadStates } from "~/utils/rework/community";

const props = defineProps({
  thread: { type: Object as PropType<ForumThreadCard>, required: true },
  compact: { type: Boolean, default: false }
});
const { t, locale } = useI18n();
const router = useRouter();
const localePath = useLocalePath();
const threadPath = computed(() => localePath(`/forum/thread/${props.thread.id}`));
const sectionName = computed(() => resolveForumSectionTranslation(t, props.thread.section.slug, props.thread.section.name));
const typeText = computed(() => {
  const type = props.thread.threadType;
  return type === "guide" ? t("forum.types.guide") : type === "achievement" ? t("forum.types.achievement") : type === "official" ? t("forum.types.official") : t("forum.types.discussion");
});
const states = computed(() => threadStates(props.thread));
const stateText = (state: string) =>
  state === "pinned" ? t("forum.states.pinned") : state === "featured" ? t("forum.states.featured") : state === "locked" ? t("forum.states.locked") : t("rework.forum.hidden");
const song = computed(() => props.thread.song);
const songName = computed(() => (song.value ? threadSongTitle(song.value, locale.value) : null));
const songTo = computed(() => (song.value ? localePath(threadSongLocation(song.value)) : ""));
// A thumbnail that fails to load is removed (no broken-image glyph); the box is reserved while it loads or once loaded.
const mediaFailed = ref(false);
watch(() => props.thread.coverImageUrl, () => (mediaFailed.value = false));
const showMedia = computed(() => !props.compact && !song.value && Boolean(props.thread.coverImageUrl) && !mediaFailed.value);
const dot = computed(() => ({ color: `var(--section-${props.thread.section.slug}, var(--ink-3))` }));

const isInteractiveTarget = (target: EventTarget | null, currentTarget: EventTarget | null) => {
  if (!(target instanceof Element)) return false;
  const interactiveTarget = target.closest("a, button, input, textarea, select, [role='button'], [role='link']");
  return Boolean(interactiveTarget && interactiveTarget !== currentTarget);
};
const openThread = () => {
  void router.push(threadPath.value);
};
const handleCardClick = (event: MouseEvent) => {
  if (isInteractiveTarget(event.target, event.currentTarget)) return;
  openThread();
};
const handleCardKeydown = (event: KeyboardEvent) => {
  if (event.key !== "Enter" || isInteractiveTarget(event.target, event.currentTarget)) return;
  event.preventDefault();
  openThread();
};
</script>

<template>
  <article
    class="tr"
    :class="{ 'is-compact': compact, 'has-song': song, 'has-media': showMedia }"
    role="link"
    tabindex="0"
    :aria-label="thread.title"
    :data-thread="thread.id"
    @click="handleCardClick"
    @keydown="handleCardKeydown"
  >
    <div class="tr__main">
      <div class="tr__meta">
        <NuxtLink :to="localePath(`/forum/section/${thread.section.slug}`)" class="tr__sec"><i class="tr__dot" :style="dot" aria-hidden="true" />{{ sectionName }}</NuxtLink>
        <span v-if="thread.threadType !== 'discussion'" class="tr__tag">{{ typeText }}</span>
        <span v-for="state in states" :key="state" class="tr__tag" :class="`is-${state}`">{{ stateText(state) }}</span>
      </div>
      <NuxtLink :to="threadPath" class="tr__title">{{ thread.title }}</NuxtLink>
      <p v-if="!compact && thread.summary" class="tr__sum">{{ thread.summary }}</p>
      <div v-if="!compact && thread.tags.length" class="tr__tags">
        <span v-for="tag in thread.tags" :key="tag">#{{ tag }}</span>
      </div>
      <div class="tr__foot">
        <ReworkCommunityAuthor :user="thread.author" :size="24" titles="text" class="tr__who" />
        <ReworkCommunityTime class="tr__time" :value="thread.latestPostAt || thread.createdAt" mode="date" />
        <span class="tr__stat" :title="t('forum.stats.reply')"><ReworkIcon name="reply" /><b class="num">{{ thread.replyCount }}</b><span class="rw-vh">{{ t("forum.stats.reply") }}</span></span>
        <span class="tr__stat" :title="t('forum.stats.like')"><ReworkIcon name="heart" /><b class="num">{{ thread.likeCount }}</b><span class="rw-vh">{{ t("forum.stats.like") }}</span></span>
        <span v-if="!compact" class="tr__stat tr__views" :title="t('forum.stats.view')"><ReworkIcon name="eye" /><b class="num">{{ thread.viewCount }}</b><span class="rw-vh">{{ t("forum.stats.view") }}</span></span>
      </div>
    </div>
    <NuxtLink v-if="song && songName" :to="songTo" class="tr__song" :aria-label="`${songName.text} · ${t('community.viewChart')}`">
      <DsCover :song-id="song.id" :size="compact ? 'md' : 'lg'" />
      <span v-if="!compact" class="tr__song-name" :lang="songName.lang">{{ songName.text }}</span>
      <DsDiff v-if="song.difficultyType" :difficulty="song.difficultyType" :star="song.level" :show-constant="false" />
    </NuxtLink>
    <NuxtLink v-else-if="showMedia" :to="threadPath" class="tr__media" tabindex="-1" aria-hidden="true">
      <ReworkCommunityMedia :src="thread.coverImageUrl" alt="" @failed="mediaFailed = true" />
    </NuxtLink>
  </article>
</template>

<style scoped>
.tr {
  position: relative;
  display: flex;
  gap: var(--sp-5);
  padding: var(--sp-4) var(--sp-2);
  margin: 0 calc(var(--sp-2) * -1);
  border-bottom: 1px solid var(--line);
  border-radius: var(--r-ctl);
  font-family: var(--font-ui);
  color: var(--ink);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.tr:hover {
  background: var(--surface-2);
}
.tr:active {
  background: var(--bg-sunk);
}
.tr:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: -2px;
}
.tr.is-compact {
  gap: var(--sp-3);
  padding-block: var(--sp-3);
}
.tr__main {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 6px;
  align-content: start;
}
.tr__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px var(--sp-2);
  font-size: var(--fs-12);
  color: var(--ink-2);
}
.tr__sec {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 24px;
  color: var(--ink-2);
  font-weight: 500;
  text-decoration: none;
}
.tr__sec:hover {
  color: var(--link);
}
.tr__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}
.tr__tag {
  display: inline-flex;
  align-items: center;
  height: var(--tag-h);
  padding: 0 6px;
  border-radius: var(--tag-radius);
  background: var(--tag-info-bg);
  color: var(--tag-info-ink);
  font-size: var(--fs-11);
}
.tr__tag.is-pinned,
.tr__tag.is-featured {
  background: var(--tag-don-bg);
  color: var(--tag-don-ink);
  font-weight: 700;
}
.tr__tag.is-hidden {
  background: var(--warn-wash);
  color: var(--ink);
}
.tr__title {
  color: var(--ink);
  font-size: var(--fs-16);
  font-weight: 700;
  line-height: 1.45;
  text-decoration: none;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.is-compact .tr__title {
  font-size: var(--fs-14);
  -webkit-line-clamp: 2;
}
.tr:hover .tr__title {
  color: var(--link);
}
.tr__sum {
  margin: 0;
  font-size: var(--fs-13);
  line-height: var(--lh-body);
  color: var(--ink-2);
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.tr__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px var(--sp-2);
  font-size: var(--fs-12);
  color: var(--ink-3);
  overflow-wrap: anywhere;
  min-width: 0;
}
.tr__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px var(--sp-3);
  margin-top: 2px;
  font-size: var(--fs-12);
  color: var(--ink-3);
  min-width: 0;
}
.tr__who {
  max-width: min(100%, 220px);
}
.tr__who :deep(.ca__name) {
  font-weight: 500;
  color: var(--ink-2);
  font-size: var(--fs-12);
}
.tr__stat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.tr__stat :deep(svg) {
  width: 14px;
  height: 14px;
}
.tr__stat b {
  font-weight: 600;
  color: var(--ink-2);
}
.tr__song {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 96px;
  min-height: var(--hit);
  color: var(--ink-2);
  text-decoration: none;
  font-size: var(--fs-12);
  text-align: center;
}
.is-compact .tr__song {
  width: auto;
  justify-content: center;
}
.tr__song-name {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tr__song:hover .tr__song-name {
  color: var(--link);
}
.tr__song:focus-visible,
.tr__sec:focus-visible,
.tr__title:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
  border-radius: var(--r-xs);
}
.tr__media {
  flex: none;
  width: 112px;
  height: 84px;
  border-radius: var(--r-ctl);
  overflow: hidden;
  background: var(--bg-sunk);
}
.tr__media :deep(.cmd) {
  width: 100%;
  height: 100%;
}
.tr__media :deep(img) {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
@media (max-width: 767px) {
  .tr {
    gap: var(--sp-3);
  }
  .tr__song {
    width: 72px;
  }
  .tr__song-name {
    display: none;
  }
  .tr__media {
    width: 72px;
    height: 72px;
  }
  .tr__views {
    display: none;
  }
}
</style>
